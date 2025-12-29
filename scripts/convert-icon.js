const pngToIco = require('png-to-ico');
const fs = require('fs');

pngToIco('public/icon.png')
    .then(buf => {
        fs.writeFileSync('public/icon.ico', buf);
        console.log('✓ Icon converted successfully: public/icon.ico');
    })
    .catch(console.error);
