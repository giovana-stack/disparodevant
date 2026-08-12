import os
import json
import requests

def main():
    url = os.environ.get("SUPA_URL")
    key = os.environ.get("SUPA_ANON_KEY")
    if not url or not key:
        print("SUPA_URL or SUPA_ANON_KEY not set")
        return

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # Verificar rascunhos pendentes de tipo noticia
    r_url = f"{url.rstrip('/')}/rest/v1/rascunhos?status=eq.pendente&tipo=eq.noticia&select=*"
    res = requests.get(r_url, headers=headers)
    if res.status_code == 200:
        data = res.json()
        print(f"Rascunhos pendentes (tipo=noticia): {len(data)}")
        for r in data:
            print(f"- ID: {r['id']}, Título: {r['titulo']}, Criado em: {r.get('criado_em')}")
    else:
        print(f"Error fetching rascunhos: {res.status_code} {res.text}")

    # Verificar postagens_instagram
    p_url = f"{url.rstrip('/')}/rest/v1/postagens_instagram?select=rascunho_id,status"
    res_inst = requests.get(p_url, headers=headers)
    if res_inst.status_code == 200:
        data_inst = res_inst.json()
        print(f"\nPostagens Instagram: {len(data_inst)}")
        for p in data_inst:
            print(f"- Rascunho ID: {p['rascunho_id']}, Status: {p['status']}")
    else:
        print(f"Error fetching postagens_instagram: {res_inst.status_code} {res_inst.text}")

if __name__ == "__main__":
    main()
