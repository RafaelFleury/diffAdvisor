---
title: Obsidian Syntax Guide
tags: [reference, obsidian, markdown, knowledge-base]
aliases: [Obsidian Markdown Guide, Wikilinks Syntax, Knowledge Base Format]
category: docs
created: 2026-02-16
---

# Obsidian Syntax Guide

A reference for writing notes in the diffAdvisor knowledge base. All `.md` files in the knowledge base must follow Obsidian document format so they work with Obsidian's graph, search, and plugins.

> [!tip]
> This guide is itself an Obsidian document. Open your knowledge base in Obsidian to see these features in action.

---

## 1. Wikilinks (Internal Links)

Wikilinks connect notes without file paths. Obsidian resolves them by note title.

### Basic link

```
[[Note Title]]
```

Example: See also [[Rate Limiting]] and [[Input Validation]].

### Link with custom display text

Use a pipe `|` to show different text:

```
[[Note Title|Display text]]
```

Example: Learn about [[JWT Authentication|JSON Web Tokens]].

### Link to a heading

Target a specific section in another note:

```
[[Note Title#Section Heading]]
```

Example: Jump to [[REST API Design#Versioning]].

### Link to a block

Reference a specific paragraph or block (Obsidian generates block IDs):

```
[[Note Title#^block-id]]
```

### Unresolved links

Links to notes that don't exist yet are valid. Obsidian shows them as creation opportunities—click to create the note.

---

## 2. YAML Frontmatter (Properties)

Metadata at the top of each note, enclosed by `---`:

```yaml
---
title: JWT Authentication
tags: [security, authentication, stateless]
category: concepts/security
aliases: [JSON Web Token, JWT token]
created: 2026-02-16
---
```

### Common properties

| Property | Format | Example |
|----------|--------|---------|
| `title` | Text | `title: My Note` |
| `tags` | List (required) | `tags: [security, api]` |
| `aliases` | List | `aliases: [alias1, alias2]` |
| `created` | Date | `created: 2026-02-16` |
| `category` | Text | `category: concepts/security` |

> [!important]
> Use plural `tags` and `aliases` as YAML lists. Obsidian 1.9+ deprecated singular `tag` and `alias`.

---

## 3. Tags

### In frontmatter

```yaml
tags: [security, authentication, backend]
```

### Inline in body

```
#tag
#nested/tag
```

Tags are searchable in Obsidian's tag pane and graph view.

---

## 4. Headings

Standard Markdown headers power Obsidian's outline:

```
# Heading 1
## Heading 2
### Heading 3
```

Use headings to structure notes and enable `[[Note#Heading]]` links.

---

## 5. Code Blocks

Always include a language identifier for syntax highlighting:

````markdown
```javascript
const token = jwt.sign(payload, secret);
```

```python
def validate_input(data):
    return sanitize(data)
```
````

---

## 6. Callouts

Highlighted blocks for notes, tips, warnings, and important info:

```
> [!note]
> General information.

> [!tip]
> Helpful suggestion.

> [!warning]
> Caution needed.

> [!important]
> Critical information.
```

### Collapsible callout

Add `-` after the type to collapse by default:

```
> [!note]- Click to expand
> Hidden content here.
```

---

## 7. Standard Markdown

| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `==highlight==` | ==highlight== |
| `~~strikethrough~~` | ~~strikethrough~~ |
| `` `inline code` `` | `inline code` |
| `[text](url)` | External link |

---

## 8. Embeds

Embed another note or file inline:

```
![[Note Name]]
![[Note#Heading]]
![[image.png]]
```

The `!` prefix embeds the content instead of linking to it.

---

## 9. Comments

Hidden text (not rendered in preview):

```
%%This won't show in preview%%
```

---

## 10. File Naming

Use readable titles with spaces, not slugs:

- ✅ `JWT Authentication.md`
- ✅ `Rate Limiting.md`
- ❌ `jwt-authentication.md`

Obsidian resolves `[[links]]` by title matching. Natural names make links more readable.

---

## Quick Reference

| Feature | Syntax |
|---------|--------|
| Link | `[[Note]]` |
| Link + display | `[[Note\|Text]]` |
| Link to heading | `[[Note#Heading]]` |
| Frontmatter | `---` YAML `---` |
| Tags (frontmatter) | `tags: [a, b]` |
| Callout | `> [!note]` |
| Highlight | `==text==` |
| Comment | `%%hidden%%` |
| Embed | `![[Note]]` |

---

## Further Reading

- [Obsidian Help - Basic formatting](https://help.obsidian.md/syntax)
- [Obsidian Flavored Markdown](https://help.obsidian.md/obsidian-flavored-markdown)
- [Internal links](https://help.obsidian.md/links)
- [Properties](https://help.obsidian.md/properties)
