#!/bin/bash

# Create directories
mkdir -p public/js public/css

cd public/js

# Download Marked.js
echo "Downloading Marked.js..."
curl -L -o marked.min.js https://cdn.jsdelivr.net/npm/marked/lib/marked.umd.js

# Download Prism core
echo "Downloading Prism.js..."
curl -L -o prism.min.js https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/prism.min.js

# Download core languages for our usage
languages=("python" "bash" "go" "c" "csharp" "sql" "powershell" "json" "yaml" "markdown" "css" "http" "rust" "php" "java" "ruby" "docker" "nginx" "markup" "clike" "javascript" "markup-templating")

for lang in "${languages[@]}"; do
    curl -L -o "prism-${lang}.min.js" "https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/components/prism-${lang}.min.js" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  ✓ $lang"
    else
        echo "  ✗ $lang (not found or failed)"
    fi
done

cd ../css
echo ""
echo "Downloading Prism CSS theme..."
curl -L -o prism-tomorrow.min.css https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/themes/prism-tomorrow.min.css

cd ../..

echo ""
echo "Done! All libraries downloaded."
echo ""
