import json
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional
import html

import markdown
from markdown.extensions.toc import TocExtension
import yaml
from pygments.formatters import HtmlFormatter

# Configuration
PUBLIC_DIR = Path("public")
BLOG_DIR = PUBLIC_DIR / "blog"
POSTS_OUTPUT_DIR = BLOG_DIR / "posts"
TEMPLATES_DIR = Path("templates")
CSS_DIR = PUBLIC_DIR / "css"


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """
    Extract YAML frontmatter from markdown content.
    Returns (metadata_dict, remaining_content)
    """
    if not content.startswith("---"):
        return {}, content

    # Find the closing ---
    end_match = re.search(r'\n---\s*\n', content[3:])
    if not end_match:
        return {}, content

    frontmatter_end = end_match.end() + 3
    frontmatter_str = content[3:end_match.start() + 3]

    try:
        metadata = yaml.safe_load(frontmatter_str) or {}
    except yaml.YAMLError as e:
        print(f"Warning: Failed to parse frontmatter: {e}")
        metadata = {}

    return metadata, content[frontmatter_end:]


def extract_title_from_content(content: str) -> Optional[str]:
    """Extract title from first H1 in content if not in frontmatter."""
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    return match.group(1).strip() if match else None


def generate_slug(filename: str) -> str:
    """Generate URL slug from filename."""
    return Path(filename).stem


def estimate_reading_time(content: str) -> int:
    """Estimate reading time in minutes (assuming 200 WPM)."""
    words = len(re.findall(r'\w+', content))
    return max(1, round(words / 200))


def extract_toc_from_html(html_content: str) -> list[dict]:
    """
    Extract table of contents from rendered HTML.
    Returns list of {id, text, level} dicts.
    """
    toc = []
    # Match h1-h4 tags with id attributes
    pattern = r'<h([1-4])\s+id="([^"]+)"[^>]*>(.+?)</h\1>'

    for match in re.finditer(pattern, html_content, re.DOTALL):
        level = int(match.group(1))
        heading_id = match.group(2)
        # Strip any nested tags from the heading text
        text = re.sub(r'<[^>]+>', '', match.group(3)).strip()
        toc.append({
            "id": heading_id,
            "text": text,
            "level": level
        })

    return toc


def add_heading_anchors(html_content: str) -> str:
    """Add anchor links to headings."""

    def replace_heading(match):
        tag = match.group(1)
        heading_id = match.group(2)
        attrs = match.group(3) or ""
        content = match.group(4)
        end_tag = match.group(5)

        anchor = f'<a href="#{heading_id}" class="heading-anchor" aria-label="Link to this section">#</a>'
        return f'<h{tag} id="{heading_id}"{attrs}>{content}{anchor}</h{end_tag}>'

    pattern = r'<h([1-4])\s+id="([^"]+)"([^>]*)>(.+?)</h([1-4])>'
    return re.sub(pattern, replace_heading, html_content, flags=re.DOTALL)


def fix_image_paths(html_content: str) -> str:
    """Fix image paths for the new directory structure (posts are in blog/posts/)."""
    # ../images/ -> ../../images/ (go up one more level)
    html_content = re.sub(
        r'src="\.\.\/images\/',
        'src="../../images/',
        html_content
    )
    return html_content


def add_copy_buttons(html_content: str) -> str:
    """Add copy buttons to code blocks."""

    # Match pre tags (which contain highlighted code)
    def replace_pre(match):
        pre_content = match.group(0)
        # Wrap in a container with copy button
        return f'''<div class="code-block-wrapper">
<button class="copy-button" onclick="copyCode(this)" aria-label="Copy code">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
<span class="copy-text">Copy</span>
</button>
{pre_content}
</div>'''

    return re.sub(r'<div class="codehilite"><pre>.*?</pre></div>', replace_pre, html_content, flags=re.DOTALL)


def generate_toc_html(toc: list[dict]) -> str:
    """Generate HTML for table of contents."""
    if not toc:
        return ""

    html_parts = ['<nav class="toc" id="toc">',
                  '<div class="toc-header">',
                  '<span class="toc-title">Contents</span>',
                  '<button class="toc-toggle" onclick="toggleToc()" aria-label="Toggle table of contents">',
                  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
                  '</button>',
                  '</div>',
                  '<ul class="toc-list">']

    for item in toc:
        indent_class = f"toc-level-{item['level']}"
        html_parts.append(
            f'<li class="{indent_class}">'
            f'<a href="#{item["id"]}">{html.escape(item["text"])}</a>'
            f'</li>'
        )

    html_parts.append('</ul></nav>')
    return '\n'.join(html_parts)


def convert_markdown_to_html(md_content: str) -> str:
    """Convert markdown to HTML with syntax highlighting."""
    md = markdown.Markdown(
        extensions=[
            'fenced_code',
            'codehilite',
            'tables',
            'attr_list',
            'md_in_html',
            TocExtension(
                permalink=False,  # We'll add our own anchors
                toc_depth=4,
                slugify=lambda value, separator: re.sub(r'[^\w\s-]', '', value.lower()).strip().replace(' ', separator)
            ),
        ],
        extension_configs={
            'codehilite': {
                'css_class': 'codehilite',
                'guess_lang': False,
                'use_pygments': True,
                'pygments_style': 'monokai',
                'noclasses': False,  # Use CSS classes
            }
        }
    )

    return md.convert(md_content)


def load_template() -> str:
    """Load the post HTML template."""
    template_path = TEMPLATES_DIR / "post.html"
    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")
    return template_path.read_text()


def render_post(template: str, metadata: dict, content_html: str, toc_html: str, reading_time: int) -> str:
    """Render the final HTML page."""
    # Format tags for display
    tags_html = ""
    if metadata.get("tags"):
        tags_list = ' • '.join(metadata["tags"])
        tags_html = f'<span class="post-tags">{tags_list}</span>'

    # Build the page
    rendered = template.replace("{{title}}", html.escape(metadata.get("title", "Blog Post")))
    rendered = rendered.replace("{{date}}", html.escape(metadata.get("date", "")))
    rendered = rendered.replace("{{tags}}", tags_html)
    rendered = rendered.replace("{{reading_time}}", str(reading_time))
    rendered = rendered.replace("{{toc}}", toc_html)
    rendered = rendered.replace("{{content}}", content_html)
    rendered = rendered.replace("{{description}}", html.escape(metadata.get("description", "")))

    return rendered


def process_post(md_path: Path, template: str) -> Optional[dict]:
    """
    Process a single markdown file.
    Returns metadata dict for index.json, or None if processing fails.
    """
    print(f"Processing: {md_path.name}")

    try:
        content = md_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  Error reading file: {e}")
        return None

    # Parse frontmatter
    metadata, md_content = parse_frontmatter(content)

    # Generate slug from filename if not in frontmatter
    slug = metadata.get("slug", generate_slug(md_path.name))
    metadata["slug"] = slug

    # Extract title from content if not in frontmatter
    if "title" not in metadata:
        metadata["title"] = extract_title_from_content(md_content) or slug.replace("-", " ").title()

    # Set defaults
    if "date" not in metadata:
        # Use file modification time as fallback
        mtime = datetime.fromtimestamp(md_path.stat().st_mtime)
        metadata["date"] = mtime.strftime("%m/%d/%Y")

    if "description" not in metadata:
        # Extract first paragraph as description
        first_para = re.search(r'^(?!#)(.+?)(?:\n\n|\n#)', md_content, re.MULTILINE | re.DOTALL)
        if first_para:
            desc = first_para.group(1).strip()[:200]
            metadata["description"] = desc + "..." if len(first_para.group(1)) > 200 else desc
        else:
            metadata["description"] = ""

    if "tags" not in metadata:
        metadata["tags"] = []

    # Calculate reading time
    reading_time = estimate_reading_time(md_content)

    # Convert markdown to HTML
    content_html = convert_markdown_to_html(md_content)

    # Extract ToC and add anchors
    toc = extract_toc_from_html(content_html)
    content_html = add_heading_anchors(content_html)

    # Add copy buttons to code blocks
    content_html = add_copy_buttons(content_html)

    # Fix image paths for new directory structure
    content_html = fix_image_paths(content_html)

    # Generate ToC HTML
    toc_html = generate_toc_html(toc)

    # Render final page
    final_html = render_post(template, metadata, content_html, toc_html, reading_time)

    # Write output file
    output_path = POSTS_OUTPUT_DIR / f"{slug}.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(final_html, encoding='utf-8')
    print(f"  → {output_path}")

    # Return metadata for index
    return {
        "title": metadata["title"],
        "slug": slug,
        "file": f"{slug}.html",  # Now points to HTML file
        "date": metadata["date"],
        "description": metadata["description"],
        "tags": metadata["tags"]
    }


def generate_pygments_css():
    """Generate Pygments CSS for syntax highlighting."""
    formatter = HtmlFormatter(style='monokai')
    css = formatter.get_style_defs('.codehilite')

    # Add some customizations for our theme
    custom_css = """
/* Pygments syntax highlighting - Monokai theme */
.codehilite {
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 1rem;
    overflow-x: auto;
    margin: 1rem 0;
}

.codehilite pre {
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
}

.codehilite code {
    background: transparent;
    padding: 0;
    color: #f8f8f2;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
}

""" + css

    output_path = CSS_DIR / "syntax.css"
    output_path.write_text(custom_css, encoding='utf-8')
    print(f"Generated: {output_path}")


def update_blog_listing():
    """Update blog.html to link to static HTML files instead of post.html?id="""
    blog_html_path = PUBLIC_DIR / "blog.html"
    if not blog_html_path.exists():
        return

    content = blog_html_path.read_text()

    # Update the link generation in JavaScript
    # Change: card.href = `post.html?id=${post.slug}`;
    # To: card.href = `blog/posts/${post.file}`;
    content = content.replace(
        'card.href = `post.html?id=${post.slug}`;',
        'card.href = `blog/posts/${post.file}`;'
    )

    blog_html_path.write_text(content)
    print(f"Updated: {blog_html_path}")


def main():
    """Main build function."""
    print("=" * 50)
    print("Blog Build Script")
    print("=" * 50)

    # Ensure output directories exist
    POSTS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    CSS_DIR.mkdir(parents=True, exist_ok=True)

    # Generate Pygments CSS
    print("\nGenerating syntax highlighting CSS...")
    generate_pygments_css()

    # Load template
    print("\nLoading template...")
    try:
        template = load_template()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Find all markdown posts
    md_files = list(BLOG_DIR.glob("*.md"))
    if not md_files:
        print("\nNo markdown files found in public/blog/")
        sys.exit(0)

    print(f"\nFound {len(md_files)} markdown file(s)")

    # Process each post
    index_entries = []
    for md_path in md_files:
        entry = process_post(md_path, template)
        if entry:
            index_entries.append(entry)

    # Sort by date (newest first)
    def parse_date(date_str):
        try:
            return datetime.strptime(date_str, "%m/%d/%Y")
        except:
            return datetime.min

    index_entries.sort(key=lambda x: parse_date(x["date"]), reverse=True)

    # Write index.json
    index_path = BLOG_DIR / "index.json"
    index_path.write_text(json.dumps(index_entries, indent=2), encoding='utf-8')
    print(f"\nGenerated: {index_path}")

    # Update blog.html links
    print("\nUpdating blog listing...")
    update_blog_listing()

    print("\n" + "=" * 50)
    print(f"Build complete! {len(index_entries)} posts processed.")
    print("=" * 50)


if __name__ == "__main__":
    main()
