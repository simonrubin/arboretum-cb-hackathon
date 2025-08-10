from __future__ import annotations

import logging
import httpx
from typing import Optional, Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)

CDP_SQL_API_URL = "https://api.cdp.coinbase.com/platform/v2/data/query/run"


class CdpDataService:
    """Service to query Coinbase CDP Data SQL API for onchain verification."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.CDP_DATA_API_KEY

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def verify_base_sepolia_usdc_transfer(
        self,
        tx_hash: str,
        from_address: Optional[str] = None,
        to_address: Optional[str] = None,
        min_amount_usdc: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Verify a USDC transfer on Base network via CDP SQL API by transaction hash.
        Optionally validate sender, recipient and minimum amount.
        """
        if not self.is_configured():
            return {"success": False, "error": "CDP_DATA_API_KEY not configured"}

        # USDC on Base Sepolia address
        usdc_address = settings.USDC_CONTRACT_ADDRESS.lower()
        tx_hash = tx_hash.lower()

        # Query logs for the Transfer event from USDC
        # The curated schema exposes base.events with decoded params. We filter by tx hash and contract address.
        sql = (
            "SELECT address, transaction_hash, event_name, parameters, block_number, block_timestamp "
            "FROM base.events "
            "WHERE lower(transaction_hash) = :tx_hash "
            "AND lower(address) = :usdc_address "
            "AND event_name = 'Transfer' LIMIT 1"
        )

        payload = {
            "sql": sql,
            "params": {
                "tx_hash": tx_hash,
                "usdc_address": usdc_address,
            },
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            try:
                resp = await client.post(CDP_SQL_API_URL, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPError as e:
                logger.error(f"CDP SQL API error: {e}")
                return {"success": False, "error": str(e)}

        rows = data.get("result") or []
        if not rows:
            return {"success": False, "error": "No matching USDC Transfer found for tx"}

        row = rows[0]
        params = row.get("parameters") or {}

        # parameters are strings; expected keys 'from', 'to', 'value'
        from_ok = True
        to_ok = True
        amount_ok = True

        if from_address:
            from_ok = (params.get("from") or "").lower().endswith(from_address.lower()[-40:])
        if to_address:
            to_ok = (params.get("to") or "").lower().endswith(to_address.lower()[-40:])
        if min_amount_usdc is not None:
            try:
                # value is uint256 in wei for USDC (6 decimals)
                raw_val = params.get("value") or "0"
                # Some rows may format values differently; coerce to int safely
                value_int = int(str(raw_val).strip().replace("{", "").replace("}", "").split()[-1], 10) if not isinstance(raw_val, int) else raw_val
                amount = value_int / (10 ** 6)
                amount_ok = amount + 1e-9 >= float(min_amount_usdc)
            except Exception as e:
                logger.warning(f"Failed to parse USDC amount: {e}")
                amount_ok = False

        verified = from_ok and to_ok and amount_ok
        return {
            "success": verified,
            "transaction_hash": row.get("transaction_hash"),
            "block_number": row.get("block_number"),
            "block_timestamp": row.get("block_timestamp"),
            "from_ok": from_ok,
            "to_ok": to_ok,
            "amount_ok": amount_ok,
        } 