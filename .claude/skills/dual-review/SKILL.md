---
name: dual-review
description: Ревью PR — запускает агента `reviewer` (структурированный, с CLAUDE.md и демо-сценарием в фокусе), который постит свой review в PR через `gh`. Используй когда пользователь говорит «сделай ревью PR», «прогони ревьюер», «полное ревью», «review this PR», даёт ссылку на PR и просит ревью.
---

# PR Review — orchestrate `reviewer` on a PR

> **Note on name:** skill называется `dual-review` по историческим причинам (раньше параллельно запускался ещё `codex-reviewer`). Сейчас работает только `reviewer`. Имя не меняется намеренно, чтобы не ломать существующие триггеры — переименуем при следующей крупной правке.

## Зачем

Структурированный ревью с проектным контекстом — `reviewer` знает CLAUDE.md, демо-сценарий, out-of-scope, RLS-политики. Найдёт нарушения архитектуры и регрессии в критическом пути демо. Постит review-комменты прямо в PR через `gh` от твоего имени.

## Когда НЕ запускать

- PR закрыт / уже смержен / draft → запросить подтверждение у пользователя.
- В PR уже есть свежий ревью от `reviewer` (коммент за последние 30 минут на текущий `headRefOid`) → предупредить «уже было ревью на этот же commit, перезапустить?» и не запускать без явного «да».
- Пользователь просит ревью локального диффа без PR → этот skill **не для этого**, отправь его на одиночный `Agent(subagent_type: "reviewer")` без gh-публикации.

## Workflow

### 1. Определи PR

Источники, в порядке приоритета:
- Явная ссылка вида `https://github.com/<owner>/<repo>/pull/<num>` или `#<num>` в задаче.
- `gh pr view --json number,state,title,headRefOid,url,isDraft` — текущий PR на текущей ветке.
- Если нет ничего → один вопрос пользователю «какой PR ревьюим?» и стоп.

### 2. Pre-flight check

```bash
gh pr view <num> --json number,state,title,headRefOid,url,isDraft,baseRefName
```

Проверь:
- `state == "OPEN"` (если `MERGED` / `CLOSED` — спроси пользователя).
- `isDraft == false` (если draft — спроси, ревьюим ли drafts).
- Запомни `headRefOid` — пригодится агенту для inline-комментов и для дедупа.

Дедуп:
```bash
gh api repos/:owner/:repo/pulls/<num>/reviews \
  --jq '[.[] | select(.commit_id == "<headRefOid>") | {state, body: .body[0:80], submitted_at}]'
```
Если видишь review с маркером «Reviewer» от того же автора за последние 30 минут — спроси про повторный прогон.

### 3. Запусти `reviewer`

```
Agent({
  subagent_type: "reviewer",
  description: "Review PR #<num>",
  prompt: "Сделай ревью PR #<num> по своему стандартному чек-листу.
           PR URL: <url>. Base branch: <base>. Head SHA: <headRefOid>.
           После того как напишешь отчёт — обязательно запости его в PR
           через `gh pr review` (verdict по самой жёсткой severity)
           + inline-комменты на C-severity через `gh api .../comments`.
           Перед публикацией дедуп: `gh api repos/:owner/:repo/pulls/<num>/reviews`
           и `.../comments`. Верни в чат краткое summary: что нашёл, что запостил."
})
```

### 4. Дождись и собери summary

Когда `Agent` вернётся — НЕ дублируй его отчёт в чат, он уже в PR. Вместо этого выдай **сводную мета-информацию**:

```
## Review запущен на PR #<num> — <PR title>

### `reviewer` (CLAUDE.md + демо-фокус)
- **Verdict:** <Approve | Comment | Request Changes>
- **Findings:** C=<n>, W=<n>, N=<n>
- **Posted:** <ссылка на review>
```

Получить ссылку на свежезапощенный review:
```bash
gh api repos/:owner/:repo/pulls/<num>/reviews \
  --jq '.[-1] | {url: .html_url, state, body: .body[0:80]}'
```

### 5. Что НЕ делать

- ❌ Не пости свой собственный второй комментарий в PR. Пользователь увидит ровно один review — от агента.
- ❌ Не интерпретируй и не пересказывай содержимое ревью в чате — пусть пользователь читает первоисточник в PR. В чате только мета: verdict, counts, link.
- ❌ Не бросай `--request-changes` от своего имени. Verdict ставит агент сам.
- ❌ Не правь код, не делай `gh pr merge / edit / close`, `git push`. Только read + один под-агент.

## Примеры триггеров

- «Сделай ревью PR #42»
- «Прогони ревьюер на этот PR: https://github.com/owner/repo/pull/42»
- «Полное ревью этого PR»
- «Запусти reviewer на текущем PR»
- «Review this PR»

## Зависимости

- Агент: [`reviewer`](../../agents/reviewer.md) — должен существовать в `.claude/agents/`.
- CLI: `gh` (авторизован, scope `repo`).
