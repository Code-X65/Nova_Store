require('dotenv').config();
const path = require('path');
const queuePath = path.resolve(__dirname, '../src/services/notification-queue.service.js');
const servicePath = path.resolve(__dirname, '../src/services/notification.service.js');

delete require.cache[queuePath];
delete require.cache[servicePath];

console.log('Loading notification-queue...');
const queue = require(queuePath);

const cachedNotificationService = require.cache[servicePath].exports;
console.log('Cached NotificationService exports:', cachedNotificationService);
console.log('Is sendToUser a function on cached exports?:', typeof cachedNotificationService.sendToUser);
process.exit(0);
