const assert = require('node:assert');
const { chromium, devices } = require('playwright');
const { readdir } = require('fs').promises;
const fileSystem = require('fs');
const http = require('http');
require('dotenv').config();

http.createServer(async (request, response) => {
    // video reading
    const files = await readdir('./');
    const videoPath = files.find((file) => file.endsWith('.webm'));
    const stat = fileSystem.statSync(videoPath);

    response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
    });

    const readStream = fileSystem.createReadStream(videoPath);
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(response);
})
    .listen(8000);

(async () => {
    // Setup
    const browser = await chromium.launch({
        headless: false, args: [
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required'
        ]
    });
    const context = await browser.newContext(devices['Desktop Chrome']);
    const page = await context.newPage();
    page.on('load', emulateWebCam)

    //init
    const detranWebsite = 'https://cnh.movscool.com.br/'
    const classLink = process.argv[2] || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const login = process.env.DETRAN_LOGIN
    const password = process.env.DETRAN_PASSWORD
    const loopTime = 2 * 60 * 1000 // 2 minutes

    //login
    await page.goto(detranWebsite);
    const userLogin = await page.waitForSelector('#email')
    const userPassword = await page.waitForSelector('#password')
    await userLogin.click()
    await userLogin.fill(login)
    await userPassword.click()
    await userPassword.fill(password)
    await userPassword.press('Enter')
    await page.waitForTimeout(2000)

    //enable cam
    await page.goto(classLink);

    async function emulateWebCam() {
        await page.evaluate(() => {
            const videoSrc = `http://localhost:8000`;
            const videoElement = document.createElement('video');

            //fetching the video
            fetch(videoSrc)
                .then(response => response.blob())
                .then(blob => {
                    const url = URL.createObjectURL(blob);
                    videoElement.src = url;
                    videoElement.loop = true
                }).catch(err => console.log('erro ao buscar o video: ', err))

            // Substituir getUserMedia para usar este vídeo como source
            navigator.mediaDevices.getUserMedia = async (constraints) => {

                if (constraints.video) {
                    const stream = await new Promise((resolve, reject) => {
                        videoElement.muted = true
                        videoElement.play().then(() => console.log('video been played')).catch(err => console.log('houve um erro ao reproduzir o vídeo: ', err))
                        resolve(videoElement.captureStream())
                    })

                    return stream
                }
            }
        });
    }
    emulateWebCam()

    async function photoClicker() {
        console.log('searching photo button')

        try {
            const photoButton = await page.waitForSelector('[aria-label="capture-button"]');
            if (photoButton.isVisible()) {
                await photoButton.click();
                console.log('foto tirada com sucesso');
            }

            await page.waitForSelector('.mdc-button__ripple')
            const okButton = await page.evaluateHandle(() => document.querySelectorAll('.mdc-button__ripple')[0].parentElement)
            okButton.click()
        }
        catch (err) {
            console.log('botão de foto não encontrado')
        }
        setTimeout(photoClicker, loopTime); // Utilizar setTimeout recursivo
    }
    setTimeout(photoClicker, loopTime); // start first looop
})();
