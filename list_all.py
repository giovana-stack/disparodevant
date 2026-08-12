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

    # Listar últimos 10 rascunhos de qualquer status
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?select=id,status,tipo,titulo&order=id.desc&limit=10"
    res = requests.get(r_url, headers=headers)
    if res.status_code == 200:
        print("Últimos 10 rascunhos:")
        for r in res.json():
            print(r)
    else:
        print(f"Error: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
