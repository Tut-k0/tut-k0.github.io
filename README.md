# David Chandler - Personal Site

Static personal website with integrated blog. No build tools, no frameworks, just simple HTML/CSS/JS.

## Technologies Used

- **Marked.js** - Markdown parsing
- **Prism.js** - Syntax highlighting
- Pure HTML/CSS/JS - No build steps required
- GitHub Actions - Automated deployment
- GitHub Pages - Free hosting

## License (What License?)

Personal site. Feel free to use the structure as inspiration, do whatever you want.


***The rest of this README is information for me, so when I inevitably forget how to add a new blog post, I'll remember this.***

## Adding Blog Posts

### Create Markdown file

Create a new `.md` file in the `public/blog/` directory. Will probably be from a direct export out of Obsidian.

**Example:** `public/blog/my-ctf-writeup.md`

```markdown
# HTB Machine Writeup: ExampleBox

Quick writeup of an interesting HTB machine.

## Enumeration

Started with a basic nmap scan:

\`\`\`bash
nmap -sV -sC 10.10.10.100
\`\`\`

## Images

Include images from the images folder:

![Screenshot](../images/screenshot.png)
```

### Update the blog index

Add an entry to `public/blog/index.json`:

```json
{
  "title": "HTB Machine Writeup: ExampleBox",
  "slug": "my-ctf-writeup",
  "file": "my-ctf-writeup.md",
  "date": "10/20/2025",
  "description": "Quick writeup of an interesting HTB machine with web exploitation.",
  "tags": ["htb", "ctf", "web"]
}
```

### Add images (if any)

Drop image files in `public/images/` and update the references to them in Markdown:

```markdown
![Alt text](../images/your-image.png)
```

Or in HTML pages:
```html
<img src="images/your-image.png" alt="Description">
```
