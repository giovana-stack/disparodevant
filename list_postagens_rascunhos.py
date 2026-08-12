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

    # Listar todas as postagens e seus rascunho_id
    r_url = f"{url.rstrip('/')}/rest/v1/postagens_instagram?select=id,rascunho_id,titulo,status"
    res = requests.get(r_url, headers=headers)
    data = res.json()
    print(f"Total postagens: {len(data)}")
    for p in data:
        print(f"Post ID: {p['id']}, Rascunho ID: {p['rascunho_id']}, Status: {p['status']}, Titulo: {p['titulo']}")

if __name__ == "__main__":
    main()
