require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();
const puppeteer = require('puppeteer');
const randomUseragent = require('random-useragent');
const { domainCleaner } = require('./helper');

// Set the server to listen on port 6060
const PORT = process.env.PORT || 6060;

const token = process.env.TELEGRAM_TOKEN;
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userMessage = msg.text;

    // Show typing status
    bot.sendChatAction(chatId, 'typing');

    // Process user message
    if (userMessage === '/start') {
        let first_name = msg.from.first_name || '';
        let welcomeMessage = `Hi ${first_name}, \nWelcome to InstaSaver Bot! \n\nTo get started, send me the link of Instagram post, Reels, IGTV, etc. to download the video. \n\nHappy downloading!`

        // send a message to the chat acknowledging receipt of their message
        bot.sendMessage(chatId, welcomeMessage);
    } else {
        let url = userMessage;
        let urlResponse = domainCleaner(url);

        if (!urlResponse.success) {
            bot.sendMessage(chatId, urlResponse.data);
            return;
        } else {
            url = urlResponse.data;
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Set a random user agent
        const userAgent = randomUseragent.getRandom();
        await page.setUserAgent(userAgent);

        try {
            // Navigate to the URL with the query parameter
            await page.goto(url);

            // wait for 5 seconds to ensure the page is fully loaded
            await page.waitForSelector('video', { timeout: 15000 });
            const ulTags = await page.$$('ul');
            let captionText = '';

            if (ulTags.length > 0) {
                // Get the first ul tag
                const firstUlTag = ulTags[0];

                // Find the immediate child div tag of the first ul tag
                const divTag = await firstUlTag.$('div');

                if (divTag) {
                    const captionTag = await divTag.$('h1');
                    if (captionTag) {
                        const captionContent = await captionTag.evaluate(tag => tag.innerText);
                        captionText = captionContent;
                    }
                } else {
                    console.log('No immediate child div found for the first ul tag.');
                }
            } else {
                console.log('No ul tags found on the page.');
            }

            const videoTags = await page.$$('video');
            console.log('\n\nNumber of video tags:', videoTags.length);

            if (videoTags.length > 0) {
                // get the first video tag
                const videoTag = videoTags[0];
                // get the src attribute
                const src = await videoTag.evaluate(tag => tag.getAttribute('src'));
                console.log('Video source:', src);

                try {
                    await bot.sendVideo(chatId, src);

                    if (captionText) {
                        // Send the caption after sending the video
                        bot.sendMessage(chatId, captionText);
                    }
                    // Send the video src after sending the video
                    // bot.sendMessage(chatId, `Here's the video: ${src}`);
                } catch (error) {
                    console.error('Error sending video:', error.message);
                    bot.sendMessage(chatId, 'Error sending video');
                }
            } else {
                console.log('No video tag found');

                // send a message to the chat acknowledging receipt of their message
                bot.sendMessage(chatId, 'No video tag found');
            }
        } catch (error) {
            console.error('Error:', error.message);
            bot.sendMessage(chatId, 'Error processing the URL \n\nMake sure the URL is correct and the post is public');
        } finally {
            // Close the browser
            await browser.close();
        }
    }
});

// Define a route for the GET request on the root endpoint '/'
app.get('/', (req, res) => {
    // Send the response 'Hello' when the endpoint is accessed
    res.send('Hello');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
