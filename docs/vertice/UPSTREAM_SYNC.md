# UPSTREAM SYNC PROTOCOL
## Protocolo de Sincronização do Vértice Hub com o Upstream DeskcommCRM

---

## 1. Princípios
1. **Upstream Nunca Entra Direto na Main:** Toda release upstream é isolada em branch `sync/upstream-vX.Y`.
2. **Merge, Jamais Rebase:** Preserva commit SHAs e histórico imutável vinculado a imagens Docker e tags no GHCR.
3. **11 Gates de Qualidade:** A branch de staging só pode ser mesclada na `main` após 100% de sucesso nos 11 gates.
4. **Deploy Sob Controle:** O Vértice Hub só atualiza para versões homologadas pela Impulsy.ai.

---

## 2. Passo a Passo de Sincronização

```bash
# 1. Atualizar referências do upstream
git checkout main
git pull origin main
git fetch upstream --tags

# 2. Criar branch de staging
git checkout -b sync/upstream-v1.26.0

# 3. Mesclar a tag do upstream
git merge v1.26.0 -m "chore: merge upstream v1.26.0 into vertice-hub"

# 4. Resolver conflitos eventuais nos arquivos de infraestrutura e navegação
# (hostgator-setup-kit/_common.sh, tests/unit/namespace-das-imagens.test.ts, lib/navigation/catalogo.ts)

# 5. Executar os 11 Gates de Qualidade
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:role-rank
pnpm test:unit
pnpm test:shell
pnpm test:db
pnpm build
pnpm e2e

# 6. Push da branch de staging e abertura de PR
git push origin sync/upstream-v1.26.0

# 7. Merge para main e publicação de Release
git checkout main
git merge sync/upstream-v1.26.0
git tag v1.26.0-vertice.1 -m "Release Vértice Hub v1.26.0-vertice.1"
git push origin main --tags
```

---

## 3. Os 11 Gates de Homologação

1. `pnpm typecheck`: Zero erros de TypeScript
2. `pnpm lint`: Zero erros novos (dívida respeitada)
3. `pnpm lint:channels`: Zero violações do canal WhatsApp
4. `pnpm lint:role-rank`: Zero violações de RBAC
5. `pnpm test:unit`: Suíte completa Vitest
6. `pnpm test:shell`: Validação de scripts e guards
7. `pnpm test:db`: Invariantes de RLS no PostgreSQL
8. `pnpm build`: Build Next.js 16 em Linux
9. `pnpm e2e`: Testes ponta a ponta Playwright
10. Image Build: Compilação das 3 imagens com namespace `ghcr.io/impulsyai`
11. Browser Smoke QA: Verificação visual das rotas principais
