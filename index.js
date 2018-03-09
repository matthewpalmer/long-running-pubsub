const request = require('request-promise-native');
const { google } = require('googleapis');

/** 
 * An API client for the Google Cloud Pub/Sub API with better support for long running tasks.
 * The @google-cloud/pubsub does a bunch of fancy work around
 * auto-extending the deadlines for acknowledgement of messages.
 * We don't want that. If the official client regains the ability to modify
 * the ack deadline manually, we should switch back to that.
 * This client aims to mirror the REST API closely.
 */
class Client {
  constructor(opts) {
    this.BASE_URL = 'https://pubsub.googleapis.com/v1';
    this.project = opts.project;
    this.longRunningJobs = {};
  }

  async addAuthentication(headers) {
    return new Promise((resolve, reject) => {
      google.auth.getApplicationDefault((err, authClient) => {
        authClient.getAccessToken((err, accessToken) => {
          const authHeader = `Bearer ${accessToken}`;
          headers['Authorization'] = authHeader;
          resolve(headers);
        });
      });

    });
  }

  // SUBSCRIBER

  formatSubscription(subscription) {
    return `projects/${this.project}/subscriptions/${subscription}`
  }

  async pull(subscription, { returnImmediately = true, maxMessages = 1 } = {}) {
    const uri = `${this.BASE_URL}/${this.formatSubscription(subscription)}:pull`;
    const headers = {};

    await this.addAuthentication(headers);

    const body = { returnImmediately, maxMessages };
    const req = { uri, headers, body, method: 'POST', json: true };
    return request(req);
  }

  async modifyAckDeadline(subscription, ackIds, ackDeadline) {
    const uri = `${this.BASE_URL}/${this.formatSubscription(subscription)}:modifyAckDeadline`;
    const headers = {};

    await this.addAuthentication(headers);

    const body = {
      ackIds, ackDeadlineSeconds: ackDeadline / 1000
    };

    const req = { uri, headers, body, method: 'POST', json: true };

    return request(req);
  }

  async acknowledge(subscription, ackIds) {
    const uri = `${this.BASE_URL}/${this.formatSubscription(subscription)}:acknowledge`;
    const headers = {};

    await this.addAuthentication(headers);

    const body = {
      ackIds
    };
    const req = { uri, headers, body, method: 'POST', json: true };
    return request(req);
  }

  // Two methods specifically tailored to long running jobs.
  // Periodically does modifyAckDeadline for you. You can still do it manually 
  // if needed.
  async pullLongRunningJob(subscription, { extendBy = 10000, withPeriod = 10000 } = {}) {
    return this.pull(subscription, { returnImmediately: true, maxMessages: 1 })
      .then(async payload => {
        if (!results || !results.receivedMessages) return;

        results = results.receivedMessages;

        if (!results || !results[0]) return;

        const payload = results[0];

        this.longRunningJobTimers[payload.ackId] = setInterval(() => {
          this.modifyAckDeadline(subscription, [payload.ackId], extendBy);
        }, withPeriod);

        await this.modifyAckDeadline(subscription, [payload.ackId], extendBy);

        return payload;
      });
  }

  async acknowledgeLongRunningJob(subscription, ackId) {
    if (this.longRunningJobTimers[ackId]) {
      clearInterval(this.longRunningJobTimers[ackId]);
      delete this.longRunningJobTimers[ackId]
    }

    return this.acknowledge(subscription, [ackId]);
  }

  // PUBLISHER

  formatTopic(topic) {
    return `projects/${this.project}/topics/${topic}`
  }

  async publish(topic, messages) {
    const uri = `${this.BASE_URL}/${this.formatTopic(topic)}:publish`;
    const headers = {};

    await this.addAuthentication(headers);

    messages = messages.map(m => {
      m.data = Buffer.from(m.data).toString('base64')
      return m;
    });

    const body = { messages };
    const req = { uri, headers, body, method: 'POST', json: true };
    return request(req);
  }
}

module.exports = Client;
