import sharp from 'sharp';

const inputPath = 'C:/Users/Acer/.gemini/antigravity/brain/4cd188f4-bcda-4200-b251-4771a19dc861/app_icon_transparent_1767023722116.png';

async function createTransparentIcon() {
    // Read the image and get raw pixel data
    const image = sharp(inputPath);
    const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Create new buffer with alpha channel
    const rgbaData = Buffer.alloc(info.width * info.height * 4);

    for (let i = 0; i < info.width * info.height; i++) {
        const srcIdx = i * info.channels;
        const dstIdx = i * 4;

        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];

        rgbaData[dstIdx] = r;
        rgbaData[dstIdx + 1] = g;
        rgbaData[dstIdx + 2] = b;

        // Make white/light colors transparent
        // If pixel is very light (close to white), make it transparent
        const brightness = (r + g + b) / 3;
        if (brightness > 240 || (r > 235 && g > 235 && b > 235)) {
            rgbaData[dstIdx + 3] = 0; // Transparent
        } else {
            rgbaData[dstIdx + 3] = 255; // Opaque
        }
    }

    // Create PNG with transparency
    await sharp(rgbaData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    })
        .resize(512, 512)
        .png()
        .toFile('public/icon-512.png');

    console.log('✓ Transparent 512x512 icon created');

    // Also create 256x256
    await sharp(rgbaData, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    })
        .resize(256, 256)
        .png()
        .toFile('public/icon.png');

    console.log('✓ Transparent 256x256 icon created');
    console.log('');
    console.log('Now run: npx electron-icon-builder --input=public/icon-512.png --output=public --flatten');
}

createTransparentIcon().catch(console.error);
