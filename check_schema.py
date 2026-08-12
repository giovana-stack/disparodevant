import os
import requests

def main():
    url = os.environ.get("SUPA_URL")
    key = os.environ.get("SUPA_ANON_KEY")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # Tentar pegar um registro qualquer para ver as colunas
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?select=*&limit=1"
    res = requests.get(r_url, headers=headers)
    print(f"Status: {res.status_code}")
    print(f"Data: {res.json()}")

if __name__ == "__main__":
    main()
