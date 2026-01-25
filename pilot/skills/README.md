# Skills

Skills are reusable knowledge modules that help the builder execute specific types of tasks better.

## How to use

1. **Browse available skills:** https://skills.sh
2. **Download relevant skill** to this folder
3. **Reference in TASK.json:**
   ```json
   {
     "context": {
       "skills": ["frontend-design", "api-patterns"]
     }
   }
   ```

## When to add skills

The orchestrator will suggest adding skills when:
- Starting UI/frontend work → `frontend-design.md`
- Working with specific frameworks → `nextjs.md`, `react-patterns.md`
- Complex domain logic → domain-specific skills

## Skill format

Each skill is a markdown file with:
- **name**: Identifier
- **description**: When to use this skill
- **guidelines**: Best practices and patterns
- **examples**: Code samples (optional)

## Creating custom skills

```markdown
---
name: my-skill
description: When to use this skill
---

## Guidelines

Your instructions here...

## Examples

Code samples here...
```

## Default skills to consider

| Skill | Use case |
|-------|----------|
| `frontend-design` | UI components, pages, styling |
| `api-patterns` | REST/GraphQL endpoints |
| `testing` | Unit/integration tests |
| `database` | Schema design, migrations |
