const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..', 'frontend');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Regex 1: Replace main header logo <a href="index.html" class="logo" ...> ... </a>
    // We match any spacing and attribute ordering
    const headerLogoRegex = /<a\s+href="index\.html"\s+class="logo"\s+style="display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;\s*text-decoration:\s*none;">\s*<span\s+class="animated-logo-text"[\s\S]*?<\/span>\s*<\/a>/gi;
    content = content.replace(headerLogoRegex, 
        `<a href="index.html" class="logo" style="display: flex; align-items: center; gap: 8px; text-decoration: none;">\n          <img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo">\n        </a>`
    );

    // Regex 2: Replace footer logo <a href="index.html" class="footer-logo" ...> ... </a>
    const footerLogoRegex = /<a\s+href="index\.html"\s+class="footer-logo"\s+style="display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;\s*text-decoration:\s*none;\s*margin-bottom:\s*15px;">\s*<span\s+class="animated-logo-text"[\s\S]*?<\/span>\s*<\/a>/gi;
    content = content.replace(footerLogoRegex, 
        `<a href="index.html" class="footer-logo" style="display: flex; align-items: center; gap: 8px; text-decoration: none; margin-bottom: 15px;">\n            <img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo">\n          </a>`
    );

    // Regex 3: Replace mobile sidebar logo <a href="index.html" class="logo" ...>brainy<span ...>grasp</span></a>
    const sidebarLogoRegex = /<a\s+href="index\.html"\s+class="logo"\s+style="font-family:\s*'Chewy',\s*cursive;\s*font-size:\s*24px;\s*color:\s*#4280ca;\s*letter-spacing:\s*1px;\s*padding-top:\s*5px;">brainy<span\s+style="color:\s*#ffc107;">grasp<\/span><\/a>/gi;
    content = content.replace(sidebarLogoRegex, 
        `<a href="index.html" class="logo" style="display: flex; align-items: center;"><img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo" style="height: 35px;"></a>`
    );

    // Regex 4: Simple sidebar logo without styling
    const sidebarSimpleLogoRegex = /<a\s+href="index\.html"\s+class="logo">brainy<span>grasp<\/span><\/a>/gi;
    content = content.replace(sidebarSimpleLogoRegex, 
        `<a href="index.html" class="logo" style="display: flex; align-items: center;"><img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo" style="height: 35px;"></a>`
    );

    // Regex 5: Checkout header logo in checkout_cod.html
    const checkoutLogoRegex = /<a\s+href="index\.html"\s+style="text-decoration:\s*none;\s*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*8px;\s*margin:\s*0\s+auto;">\s*<span\s+class="animated-logo-text"[\s\S]*?<\/span>\s*<\/a>/gi;
    content = content.replace(checkoutLogoRegex, 
        `<a href="index.html" style="text-decoration: none; display: flex; align-items: center; gap: 8px; margin: 0 auto;">\n    <img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo" style="height: 40px;">\n  </a>`
    );

    // Regex 6: Login.html brand logo
    const loginLogoRegex = /<div\s+class="brand"\s+style="display:\s*flex;\s*flex-direction:\s*column;\s*align-items:\s*flex-start;\s*gap:\s*8px;\s*margin-bottom:\s*20px;">\s*<a\s+href="index\.html"\s+style="text-decoration:\s*none;\s*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*6px;">\s*<span\s+class="animated-logo-text"[\s\S]*?<\/span>\s*<\/a>/gi;
    content = content.replace(loginLogoRegex, 
        `<div class="brand" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 20px;">\n        <a href="index.html" style="text-decoration: none; display: flex; align-items: center; gap: 6px;">\n          <img src="images/logo.jpeg" alt="BrainyGrasp Logo" class="brand-logo" style="height: 40px;">\n        </a>`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Updated logo in: ${path.basename(filePath)}`);
    }
}

function traverse(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'images' && file !== 'css' && file !== 'js' && file !== 'affiliate') {
                traverse(fullPath);
            }
        } else if (file.endsWith('.html')) {
            processFile(fullPath);
        }
    });
}

traverse(frontendDir);
console.log('Logo substitution finished.');
