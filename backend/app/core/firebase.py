import os
import base64
import json
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

load_dotenv()  # Load .env file

# Decode base64 and parse JSON
firebase_key_b64 = os.getenv("FIREBASE_KEY_B64")

firebase_key_json = json.loads(base64.b64decode(firebase_key_b64))

# Initialize Firebase
cred = credentials.Certificate(firebase_key_json)
firebase_admin.initialize_app(cred, {
    "storageBucket": "pmarket-arbitrage.firebasestorage.app"
})

db = firestore.client()

def read_arbs():
    # Get first 5 docs from arbs collection
    docs = db.collection("arbs").stream()
    
    # Convert to list of dicts
    return [doc.to_dict() for doc in docs]
    