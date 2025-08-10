#!/usr/bin/env python3
"""
Test Arboretum Service - Verify all endpoints work
"""
import requests
import sys
import time

def test_endpoints():
    """Test all service endpoints"""
    base_url = "http://localhost:8000"
    
    tests = [
        ("GET", "/", "Root endpoint"),
        ("GET", "/health", "Health check"),
        ("GET", "/discovery", "Service discovery"),
        ("GET", "/dashboard", "Dashboard UI"),
        ("GET", "/api/stats", "Dashboard stats API"),
    ]
    
    print("🧪 Testing Arboretum Service Endpoints")
    print("=" * 50)
    
    all_passed = True
    
    for method, endpoint, description in tests:
        try:
            url = base_url + endpoint
            response = requests.request(method, url, timeout=5)
            
            if response.status_code == 200:
                print(f"✅ {description}: {response.status_code}")
            else:
                print(f"❌ {description}: {response.status_code}")
                all_passed = False
                
        except requests.exceptions.ConnectionError:
            print(f"❌ {description}: Service not running")
            all_passed = False
        except Exception as e:
            print(f"❌ {description}: {e}")
            all_passed = False
    
    print("=" * 50)
    if all_passed:
        print("🎉 All tests passed! Service is ready for demo.")
    else:
        print("⚠️  Some tests failed. Check service status.")
        return 1
    
    return 0

if __name__ == "__main__":
    print("Make sure the service is running first:")
    print("  python run_service.py")
    print("")
    time.sleep(2)
    
    exit_code = test_endpoints()
    sys.exit(exit_code)