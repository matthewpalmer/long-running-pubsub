# long-running-pubsub

A Node.js Google Cloud Pub/Sub client that closely mirrors [the REST API](https://cloud.google.com/pubsub/docs/reference/rest/) with added support for long running tasks and jobs.

* Manual control over pull and publish
* Manual support for controlling a message's `ackDeadline`
* Automatic support for long-running job management

## Quick Start

To get started, follow the [the usual Google Cloud API procedure](https://github.com/googleapis/nodejs-pubsub#quickstart) to set up your project, authenticate, and enable API access.

## Usage for long running tasks

```js
const PubSub = require('long-running-pubsub');

const client = new PubSub({
  project: PROJECT_ID,
  // Optionally provide a logging function for debugging
  // log: console.log
});

// Get messages corresponding to a long running job that you're going to start
const job = client.pullLongRunningJob(SUBSCRIPTION, {
  // How long to defer the ackDeadline
  extendBy: 15000,
  // How often to do this deferring
  withPeriod: 10000
});

job.then(payload => {
  if (!payload) {
    console.log(`There are no messages on the queue.`);
    return;
  }

  // Simulate a long running job that takes two minutes
  console.log(`Starting a long running job...`);

  setTimeout(() => {
    // The job's done. The library managed the ackDeadline during this time
    // to reduce duplicate notifications (though they  can't be 100% eliminated)
    console.log(`Job done.`);

    // Acknowledge the job is finished
    client.acknowledgeLongRunningJob(SUBSCRIPTION, payload.ackId)
      .then(() => {
        console.log(`Job status acknowledged`);
      })
  }, 120000);
})
```

## Usage with the REST API

This client exposes an interface that closely resembles the REST API so that you have
fine-grained manual control over pull, publish, and acknowledgement deadline management.

```js
class Client {
  // Subscriber
  acknowledge(subscription, ackIds)
  modifyAckDeadline(subscription, ackIds, ackDeadline)
  pull(subscription, { returnImmediately = true, maxMessages = 1 } = {})

  // Long running tasks
  pullLongRunningJob(subscription, { extendBy = 10000, withPeriod = 10000 } = {})
  acknowledgeLongRunningJob(subscription, ackId)

  // Publisher
  publish(topic, messages)
}
```
