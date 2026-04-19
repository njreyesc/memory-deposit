---
name: dual-review
description: Двойное ревью PR — параллельно запускает агенты `reviewer` (структурированный, с CLAUDE.md и демо-сценарием в фокусе) и `codex-reviewer` (adversarial second-opinion от OpenAI Codex). Каждый постит свой ревью в PR через `gh`. Используй когда пользователь говорит «двойное ревью», «второй мнение», «прогони оба ревьюера», «полное ревью», «review this PR with second opinion», даёт ссылку на PR и просит подробное ревью.
---

# Dual Review — orchestrate `reviewer` + `codex-reviewer` on a PR

## Зачем

Один ревьюер = одна точка зрения. Два ревьюера разных «школ» (структурированный с проектным контекстом + adversarial с другой модельной семьёй) ловят разные классы багов:

- **`reviewer`** — знает CLAUDE.md, демо-сценарий, out-of-scope, RLS-политики. Найдёт нарушения архитектуры и регрессии в критическом пути демо.
- **`codex-reviewer`** — adversarial, презумпция «код содержит баг», ищет edge cases / hidden regressions / unsafe assumptions. Второе мнение от OpenAI-семьи, ловит то, что Claude мог пропустить.

Оба независимо постят в PR — пользователь видит две независимые ветки замечаний и решает, что мержить.

## Когда НЕ запускать

- PR закрыт / уже смержен / draft → запросить подтверждение у пользователя.
- В PR уже есть свежий dual-review (комменты от обоих агентов за последние 30 минут на текущий `headRefOid`) → предупредить «уже было ревью на этот же commit, перезапустить?» и не запускать без явного «да».
- Пользователь просит ревью локального диффа без PR → этот skill **не для этого**, отправь его на одиночный `Agent(subagent_type: "reviewer")`.

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
- Запомни `headRefOid` — пригодится агентам для inline-комментов и для дедупа.

Дедуп с предыдущим dual-review:
```bash
gh api repos/:owner/:repo/pulls/<num>/reviews \
  --jq '[.[] | select(.commit_id == "<headRefOid>") | {state, body: .body[0:80], submitted_at}]'
```
Если видишь два недавних review с маркерами «Codex Review» и «Reviewer» от того же автора — спроси про повторный прогон.

### 3. Запусти оба агента ПАРАЛЛЕЛЬНО

В **одном сообщении** два tool-call'а `Agent` (это критично — иначе агенты пойдут последовательно и потратят вдвое больше времени):

```
Agent({
  subagent_type: "reviewer",
  description: "Review PR #<num>",
  prompt: "Сделай ревью PR #<num> по своему стандартному чек-листу. PR URL: <url>. Base branch: <base>. Head SHA: <headRefOid>. После того как напишешь отчёт — обязательно запости его в PR через `gh pr review` (verdict по самой жёсткой severity) + inline-комменты на C-severity через `gh api .../comments`. Перед публикацией дедуп: `gh api repos/:owner/:repo/pulls/<num>/reviews` и `.../comments`. Верни в чат краткое summary: что нашёл, что запостил."
})

Agent({
  subagent_type: "codex-reviewer",
  description: "Adversarial review PR #<num>",
  prompt: "Запусти adversarial Codex review на PR #<num>. PR URL: <url>. Base branch: <base>. Используй `npx --yes @openai/codex review --base <base> '...'`. После прогона и фильтра — запости в PR через `gh pr review` (с пометкой «Codex Review (adversarial second opinion)» в теле, чтобы было видно отличие от обычного reviewer'а). Inline-комменты только для C-severity. Перед публикацией дедуп. Верни в чат краткое summary."
})
```

**Почему параллельно:** оба агента долгие (codex-reviewer — 1-3 минуты на средний diff, reviewer — 30s-2min). Параллельный запуск экономит ~50% времени и реально ощущается на питч-горящем PR.

### 4. Дождись обоих и собери summary

Когда оба `Agent` вернутся — НЕ дублируй их отчёты в чат, они уже в PR. Вместо этого выдай **сводную мета-информацию**:

```
## Dual Review запущен на PR #<num> — <PR title>

### `reviewer` (CLAUDE.md + демо-фокус)
- **Verdict:** <Approve | Comment | Request Changes>
- **Findings:** C=<n>, W=<n>, N=<n>
- **Posted:** <ссылка на review>

### `codex-reviewer` (adversarial Codex second opinion)
- **Verdict:** <Approve | Comment | Request Changes>
- **High-signal findings:** <n>
- **Posted:** <ссылка на review>

### Пересечение находок
<если оба отметили одну и ту же строку — выдели; это самые надёжные баги>

### Уникально у Codex
<что нашёл только codex-reviewer — обычно edge cases и hidden regressions>

### Уникально у reviewer
<что нашёл только reviewer — обычно архитектурные нарушения и demo regressions>
```

Получить ссылки на свеже-запощенные ревью:
```bash
gh api repos/:owner/:repo/pulls/<num>/reviews \
  --jq '.[-2:] | .[] | {url: .html_url, state, body: .body[0:80]}'
```

Пересечение находок — простая эвристика: парсь `file:line` из обоих отчётов и ищи совпадения по файлу + ±3 строки. Не строй сложный алгоритм — это вспомогательный сигнал, не основной артефакт.

### 5. Что НЕ делать

- ❌ Не пости свой собственный третий комментарий в PR. Пользователь увидит ровно два ревью — от каждого агента.
- ❌ Не интерпретируй и не пересказывай содержимое ревью в чате — пусть пользователь читает первоисточник в PR. В чате только мета: verdict, counts, links, пересечение.
- ❌ Не запускай агентов последовательно. Если уже сделал один — стоп, переделывай батчем.
- ❌ Не бросай `--request-changes` от своего имени. Verdict ставит каждый агент сам.
- ❌ Не правь код, не делай `gh pr merge / edit / close`, `git push`. Только read + два под-агента.

## Примеры триггеров

- «Сделай двойное ревью PR #42»
- «Прогони оба ревьюера на этот PR: https://github.com/owner/repo/pull/42»
- «Полное ревью с второй мнением»
- «Запусти reviewer и codex-reviewer параллельно на текущем PR»
- «Review this PR with second opinion»

## Зависимости

- Агенты: [`reviewer`](../../agents/reviewer.md), [`codex-reviewer`](../../agents/codex-reviewer.md) — должны существовать в `.claude/agents/`.
- CLI: `gh` (авторизован, scope `repo`), `npx` для `@openai/codex` (авторизован через `codex login`).
- Если codex не залогинен — `codex-reviewer` сам сообщит и остановится; `reviewer` всё равно отработает. В summary честно укажи «Codex недоступен, было одно ревью».
