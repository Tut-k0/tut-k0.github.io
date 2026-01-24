#!/usr/bin/env node
/**
 * Syntax Highlighting Helper
 * 
 * Reads code from stdin, outputs highlighted HTML to stdout.
 * Used by the Python build script.
 * 
 * Usage: echo "code" | node highlight.mjs <language> [theme]
 */

import { createHighlighter } from 'shiki';

const args = process.argv.slice(2);
const lang = args[0] || 'text';
const theme = args[1] || 'github-dark';

// Read from stdin
let code = '';
process.stdin.setEncoding('utf8');

for await (const chunk of process.stdin) {
    code += chunk;
}

// Remove trailing newline if present
code = code.replace(/\n$/, '');

try {
    const highlighter = await createHighlighter({
        themes: [theme],
        langs: [lang]
    });

    const html = highlighter.codeToHtml(code, { 
        lang, 
        theme,
    });

    process.stdout.write(html);
} catch (error) {
    // If language isn't supported, fall back to plain text styling
    if (error.message.includes('Language') || error.message.includes('lang')) {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        process.stdout.write(
            `<pre class="shiki" style="background-color:#24292e;color:#e1e4e8" tabindex="0"><code>${escaped}</code></pre>`
        );
    } else {
        console.error(`Highlighting error: ${error.message}`);
        process.exit(1);
    }
}
