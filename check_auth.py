import os
import requests

def main():
    url = os.environ.get("SUPA_URL")
    key = os.environ.get("SUPA_ANON_KEY")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }

    # Tentar listar tabelas via rpc se existir algum helper comum (improvável)
    # Mas vamos apenas tentar ler de uma tabela que sabidamente funciona
    r_url = f"{url.rstrip('/')}/rest/v1/postagens_instagram?select=id&limit=1"
    res = requests.get(r_url, headers=headers)
    print(f"Postagens Instagram (status): {res.status_code}")
    
    # Tentar rascunhos de novo
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?select=id&limit=1"
    res = requests.get(r_url, headers=headers)
    print(f"Rascunhos (status): {res.status_code}")

if __name__ == "__main__":
    main()
