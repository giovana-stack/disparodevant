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

    # Listar todos os IDs da rascunhos sem limite
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?select=id,status,tipo,titulo"
    res = requests.get(r_url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Total rascunhos: {len(data)}")
        for r in data:
            if r['id'] == 195:
                print(f"FOUND 195: {r}")
            # print(r)
    else:
        print(f"Error: {res.status_code} {res.text}")

if __name__ == "__main__":
    main()
