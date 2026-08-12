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

    # Buscar registro 195 sem filtros de status/tipo
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?id=eq.195&select=*"
    res = requests.get(r_url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Rascunho 195: {data}")
    else:
        print(f"Error: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
