# David Chandler - Personal Site

Static personal website with integrated blog. No frameworks, just simple HTML/CSS/JS with a lightweight Python + Node.js build step for the blog.

## Technologies Used

- **Python + Markdown** - Build-time Markdown to HTML conversion
- **Shiki** - VS Code-quality syntax highlighting (via Node.js)
- Pure HTML/CSS/JS - No frontend frameworks
- GitHub Actions - Automated deployment
- GitHub Pages - Free hosting

## License (What License?)

Personal site. Feel free to use the structure as inspiration, do whatever you want.


---

## Blog Workflow

### Adding a New Blog Post

1. **Create a markdown file** in `public/blog/`:

```markdown
---
title: "Your Post Title"
slug: "your-post-slug"
date: "MM/DD/YYYY"
description: "A brief description for the blog listing and SEO."
tags: ["tag1", "tag2", "tag3"]
---

# Your Post Title

Your content here...
```

2. **Add images** (if any) to `public/images/` and reference them:

```markdown
![Alt text](../images/your-image.png)
```

3. **Build locally** to preview changes:
   ```bash
   # Install dependencies (first time only)
   npm install
   pip install -r requirements.txt
   
   # Build the blog
   python build.py
   ```

   This generates:
   - `public/blog/posts/*.html` - Static HTML posts with Shiki-highlighted code
   - `public/blog/index.json` - Auto-generated blog index

4. **Commit and push** - Merge new branch to deploy to GitHub Pages.

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title (used in page title and ToC) |
| `slug` | No | URL slug (defaults to filename) |
| `date` | Yes | Publication date (MM/DD/YYYY format) |
| `description` | Yes | Brief description for listings and SEO |
| `tags` | No | Array of tags for filtering |
