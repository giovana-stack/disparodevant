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

    # Tentar buscar id=195 na rascunhos sem filtros de status
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?id=eq.195&select=*"
    res = requests.get(r_url, headers=headers)
    print(f"Rascunhos with id=195: {res.json()}")

    # Tentar buscar status=pendente na rascunhos sem filtro de tipo
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?status=eq.pendente&select=*"
    res = requests.get(r_url, headers=headers)
    print(f"Pending rascunhos (all types): {res.json()}")

if __name__ == "__main__":
    main()
