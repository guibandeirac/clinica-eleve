# PRD — Sistema de Gestão de Pacientes e Cobranças (Clínica)

> Documento de requisitos para implementação via **Claude Code**.
> Stack: **Next.js (App Router) + Supabase**. Idioma da interface: **Português (BR)**.

---

## 1. Visão geral

Sistema interno para uma clínica controlar **pacientes**, **tratamentos/procedimentos** e, principalmente, o **fluxo de cobranças** — incluindo pagamentos recorrentes (PIX semanal/mensal) amarrados a tratamentos de prazo definido.

O sistema é a **fonte da verdade interna**: a equipe registra os tratamentos, o sistema gera as parcelas/cobranças automaticamente, e a equipe **dá baixa manualmente** conforme recebe. Não há integração com gateway de pagamento nem disparo automático de mensagens nesta versão.

### Objetivo central
Responder, a qualquer momento, com clareza:
- **Quem** precisa ser cobrado
- **Quanto** e por **qual forma** (crédito, PIX ou espécie)
- **Quando** vence cada cobrança
- O que está **pendente, pago ou atrasado**

---

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Backend / DB | Supabase (Postgres + Auth + RLS) |
| Auth | Supabase Auth (email/senha) |
| Datas | date-fns (timezone `America/Sao_Paulo`) |
| Deploy | Vercel |

### Convenções
- Valores monetários em **centavos** (integer) no banco; formatação `R$` na UI.
- Datas de vencimento como `date` (sem hora).
- Todo timestamp de auditoria em `timestamptz`.

---

## 3. Perfis de usuário e permissões (RBAC)

Há 3 perfis. **Todos enxergam todos os pacientes e cobranças** (visibilidade total). O que muda é o conjunto de **ações** permitidas.

| Ação | Admin | Recepção | Profissional |
|---|:---:|:---:|:---:|
| Visualizar pacientes / tratamentos / cobranças | ✅ | ✅ | ✅ |
| Criar / editar paciente | ✅ | ✅ | ✅ |
| Excluir paciente | ✅ | ❌ | ❌ |
| Criar / editar tratamento | ✅ | ✅ | ✅ |
| Excluir tratamento | ✅ | ❌ | ❌ |
| Dar baixa em cobrança (marcar pago) | ✅ | ✅ | ✅ |
| Estornar baixa (voltar para pendente) | ✅ | ✅ | ❌ |
| Gerenciar usuários e perfis | ✅ | ❌ | ❌ |

> A matriz é o ponto de partida; manter as regras centralizadas (ex: um helper `can(action, role)`) para facilitar ajuste.

---

## 4. Modelo de dados

### 4.1 `profiles`
Espelha os usuários do Supabase Auth.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | = `auth.users.id` |
| nome | text | |
| email | text | |
| role | text | `admin` \| `recepcao` \| `profissional` |
| ativo | boolean | default `true` |
| created_at | timestamptz | default `now()` |

### 4.2 `patients` (pacientes)

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| nome | text | obrigatório |
| telefone | text | opcional |
| cpf | text | opcional |
| observacoes | text | opcional |
| ativo | boolean | default `true` |
| created_at | timestamptz | |
| created_by | uuid | FK → profiles |

### 4.3 `treatments` (tratamentos)
Um paciente pode ter vários tratamentos ao longo do tempo.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| patient_id | uuid | FK → patients |
| profissional_id | uuid | FK → profiles (responsável, opcional) |
| procedimento | text | **texto livre** (descrição) |
| forma_pagamento | text | `credito` \| `pix` \| `especie` |
| tipo_cobranca | text | `avista` \| `recorrente` |
| periodicidade | text \| null | `semanal` \| `mensal` (só se recorrente) |
| num_parcelas | int | nº de semanas/meses (ex: 10). `1` se à vista |
| valor_parcela_centavos | int | valor de **cada** parcela |
| data_inicio | date | vencimento da 1ª parcela |
| status | text | `ativo` \| `concluido` \| `cancelado` |
| observacoes | text | opcional |
| created_at | timestamptz | |
| created_by | uuid | FK → profiles |

> **Valor total** do tratamento = `num_parcelas * valor_parcela_centavos` (derivado, não armazenado).

### 4.4 `charges` (cobranças / parcelas)
Geradas automaticamente a partir do tratamento.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | |
| treatment_id | uuid | FK → treatments (ON DELETE CASCADE) |
| numero_parcela | int | 1..num_parcelas |
| valor_centavos | int | copiado do tratamento (permite edição pontual) |
| data_vencimento | date | calculada na geração |
| forma_pagamento | text | herda do tratamento; editável na baixa |
| status | text | `pendente` \| `pago` (atraso é **derivado**, ver 5.2) |
| data_pagamento | date \| null | preenchida na baixa |
| baixado_por | uuid \| null | FK → profiles |
| created_at | timestamptz | |

---

## 5. Regras de negócio

### 5.1 Geração de parcelas
Ao **criar um tratamento**, o sistema gera as cobranças automaticamente (idealmente em uma transação / RPC do Supabase):

- **À vista:** 1 cobrança, vencimento = `data_inicio`.
- **Recorrente semanal:** `num_parcelas` cobranças, vencimentos a cada 7 dias a partir de `data_inicio`.
- **Recorrente mensal:** `num_parcelas` cobranças, vencimentos somando 1 mês a cada parcela (tratar fim de mês com date-fns `addMonths`).

Exemplo: tratamento PIX recorrente, semanal, 10 parcelas de R$ 80, início 02/06 → 10 cobranças de R$ 80 vencendo 02/06, 09/06, 16/06... até a 10ª.

### 5.2 Status "atrasado" (derivado)
O banco guarda só `pendente` / `pago`. **Atrasado é calculado em runtime:**

```
status_exibido =
  pago      → se status = 'pago'
  atrasado  → se status = 'pendente' E data_vencimento < hoje
  pendente  → caso contrário
```

> Evita necessidade de cron job. Implementar como helper único usado em todas as telas.

### 5.3 Dar baixa
Ao marcar como pago: `status = 'pago'`, `data_pagamento = hoje` (editável), `forma_pagamento` confirmada/ajustada, `baixado_por = usuário atual`.

### 5.4 Conclusão do tratamento
Quando **todas** as parcelas de um tratamento estão `pago`, marcar `treatments.status = 'concluido'` (pode ser automático via trigger ou recalculado na leitura).

### 5.5 Edição
- Editar `valor_centavos` de uma parcela individual é permitido (ex: desconto pontual).
- Cancelar um tratamento (`status = 'cancelado'`) deve manter o histórico das parcelas já pagas; parcelas pendentes podem ser ocultadas dos painéis de cobrança.

---

## 6. Telas / Funcionalidades

### 6.1 Login
Supabase Auth (email/senha). Redireciona para o Dashboard.

### 6.2 Dashboard (visão geral)
Cartões e listas com foco em cobrança:
- **A vencer hoje** / **nesta semana** (contagem + valor total)
- **Atrasadas** (destaque visual, contagem + valor)
- **Recebido no mês** (soma das baixas do mês)
- **A receber no mês** (pendentes do mês)
- Distribuição por forma de pagamento (crédito / PIX / espécie)
- Atalho para a fila de cobranças filtrada por "atrasadas".

### 6.3 Pacientes
- Lista com busca (nome/telefone), filtro ativo/inativo.
- Criar / editar paciente.
- **Detalhe do paciente:** dados + lista de tratamentos + histórico de cobranças (pagas e pendentes) com totais.

### 6.4 Tratamentos
- Criado a partir do paciente (ou tela própria).
- Formulário: procedimento (texto livre), profissional responsável, forma de pagamento, tipo (à vista/recorrente), periodicidade, nº de parcelas, valor por parcela, data de início.
- **Preview das parcelas** antes de salvar (mostra as datas e valores que serão gerados).

### 6.5 Cobranças (a fila — coração do sistema)
A tela mais importante. Lista de todas as cobranças com:
- **Filtros:** status (pendente / atrasado / pago / todos), período (vencimento), forma de pagamento, profissional, busca por paciente.
- **Ordenação padrão:** vencimento ascendente, atrasadas no topo.
- Cada linha: paciente, procedimento, parcela (ex: 3/10), valor, vencimento, forma, status.
- **Ação rápida:** botão "Marcar como pago" inline (modal de confirmação com data e forma).
- Visão sugerida: agrupar por "Atrasadas", "Esta semana", "Próximas".

### 6.6 Usuários (somente admin)
- Listar / criar / desativar usuários e definir perfil.

---

## 7. Segurança (RLS no Supabase)

- **RLS habilitado** em todas as tabelas.
- Leitura (`select`): permitida a qualquer usuário autenticado com `profiles.ativo = true` (visibilidade total).
- Escrita: validar `role` via função `auth.uid()` → `profiles.role`, espelhando a matriz da seção 3.
- Exclusões (paciente/tratamento) e gestão de usuários: apenas `admin`.
- Helper de permissão no frontend **e** policies no banco (defesa em profundidade — nunca confiar só no front).

---

## 8. User stories (fluxos principais)

1. *Como recepção, cadastro um paciente novo e crio um tratamento de 10 sessões pagas via PIX semanal, e o sistema gera as 10 cobranças automaticamente.*
2. *Como recepção, abro a fila de cobranças, vejo quem está atrasado e quem vence esta semana, e dou baixa nos PIX que já caíram.*
3. *Como profissional, consulto o histórico de um paciente e vejo quanto ele já pagou e quanto falta.*
4. *Como admin, vejo no dashboard quanto a clínica tem a receber no mês e quanto já recebeu.*
5. *Como admin, cadastro um novo profissional e defino seu perfil de acesso.*

---

## 9. Critérios de aceite (MVP)

- [ ] Login funcional com os 3 perfis e permissões respeitadas (front + RLS).
- [ ] CRUD de pacientes.
- [ ] Criação de tratamento gera as parcelas corretas (à vista, semanal, mensal) com datas certas.
- [ ] Preview de parcelas antes de salvar o tratamento.
- [ ] Fila de cobranças com filtros, status derivado (atrasado) e baixa manual.
- [ ] Dashboard com a vencer / atrasadas / recebido no mês / a receber.
- [ ] Detalhe do paciente com histórico completo de cobranças.
- [ ] Tratamento marca-se como concluído quando todas as parcelas são pagas.

---

## 10. Fora de escopo (nesta versão)

- Integração com gateway PIX / cobrança automática.
- Disparo automático de mensagens (WhatsApp, e-mail, SMS).
- Portal/login para o paciente.
- Emissão de nota fiscal / recibo.
- Relatórios avançados e exportações (possível Fase 2).

### Possíveis evoluções (Fase 2)
- Lembretes automáticos de cobrança (WhatsApp).
- Exportação de relatórios (CSV/PDF).
- Geração de recibo por pagamento.
- Anexos no prontuário do paciente.

---

## 11. Ordem sugerida de implementação para o Claude Code

1. Setup do projeto (Next.js App Router + Tailwind + shadcn/ui) e conexão Supabase.
2. Migrations: tabelas `profiles`, `patients`, `treatments`, `charges` + RLS.
3. Auth + criação automática de `profiles` no signup + seed de um admin.
4. CRUD de pacientes.
5. Criação de tratamento + **RPC/transação de geração de parcelas** + preview.
6. Fila de cobranças (filtros + status derivado + baixa manual).
7. Dashboard.
8. Tela de usuários (admin).
9. Polimento de UI/UX e validações.

> Sugestão: começar pelo schema + a função de geração de parcelas, pois é a regra de negócio mais sensível. Validar as datas geradas antes de seguir.
