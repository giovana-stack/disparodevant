## Problema

O login autentica no servidor com sucesso (`unlockApp` retorna `ok:true`), mas a chamada seguinte a `getAuthState` retorna `unlocked:false`. Isso mantém o usuário preso na tela de login.

Confirmado nos logs de rede: o POST de unlock retorna sucesso, mas o GET imediatamente depois não enxerga a sessão — ou seja, o cookie definido pelo servidor não está sendo reenviado pelo navegador.

## Causa

O preview do Lovable é carregado dentro de um iframe em outro domínio, então o navegador trata os cookies do app como "third-party". Em `src/lib/session.ts` o cookie está configurado com:

```
sameSite: "lax"
```

Cookies `SameSite=Lax` **não são enviados** em requisições dentro de iframes cross-site. Por isso o cookie de sessão é gravado mas nunca retorna nas próximas chamadas.

## Correção

Alterar `src/lib/session.ts` para permitir uso em iframe:

- `sameSite: "none"` (necessário para envio cross-site)
- `secure: true` (obrigatório junto com `SameSite=None`, já está)

Com isso o cookie será enviado tanto no preview em iframe quanto no site publicado.

## Verificação

Após a mudança:
1. Recarregar o preview.
2. Digitar a senha.
3. Deve entrar direto no app (4 abas) e permanecer logado ao recarregar.
4. Conferir nos logs de rede que o `getAuthState` posterior ao login retorna `unlocked:true`.
