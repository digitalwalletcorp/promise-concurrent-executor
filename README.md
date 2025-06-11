# Promise Concurrent Executor

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Fpromise-concurrent-executor)](https://www.npmjs.com/package/@digitalwalletcorp/promise-concurrent-executor) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Fpromise-concurrent-executor)](https://opensource.org/licenses/MIT) ![Environment](https://img.shields.io/badge/environment-Node.js%20%7C%20Browser-blue) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/promise-concurrent-executor/ci.yml?branch=main)](https://github.com/digitalwalletcorp/promise-concurrent-executor/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/promise-concurrent-executor.svg)](https://codecov.io/gh/digitalwalletcorp/promise-concurrent-executor)

A JavaScript library to control Promise concurrency. It processes asynchronous tasks up to a specified limit, offering queuing and automated execution. Ideal for stabilizing async operations, preventing excessive resource consumption, and improving application performance by managing the flow of API calls or data processing.

## ✨ Features

* Control Promise Async Call: Manage the maximum number of asynchronous operations running simultaneously.
* Configurable Concurrency: Easily set how many processes can run at the same time.
* Dynamic Task Addition: Add new Promise functions to the queue even while execution is in progress (though add and addWithAutoExecute have limitations for isRunning state).

## ✅ Compatibility

This library is Isomorphic / Universal, meaning it is designed to run in multiple JavaScript environments. It has no dependencies on platform-specific APIs.

- ✅ **Node.js**: Fully supported on all modern Node.js versions.
- ✅ **Browsers**: Fully supported on all modern browsers that support ES2020 (Promises, async/await).

## 📦 Installation

```bash
npm install @digitalwalletcorp/promise-concurrent-executor
# or
yarn add @digitalwalletcorp/promise-concurrent-executor
```

## 📖 Usage

The `PromiseConcurrentExecutor` helps you manage a queue of asynchronous tasks, ensuring that only a specified number run in parallel. You can add tasks to the queue and then trigger their execution using `executeAll` or `executeAllSettled`.

### ⚖️ `executeAll` vs. `executeAllSettled`

Both methods execute all queued Promise functions, but they handle rejected Promises differently:

* `executeAll<T>()`: Similar to `Promise.all()`, this method starts all queued Promise functions and awaits their completion. If any of the Promises reject, `executeAll` will immediately reject with the reason of the first Promise that failed. The return type supports array or tuple types for its generic `T`.
* `executeAllSettled<T>()`: Similar to `Promise.allSettled()`, this method executes all queued Promise functions regardless of whether they succeed or fail. It always returns an array of `PromiseSettledResult` objects, where each object indicates the status (`'fulfilled'` or `'rejected'`) and the `value` or `reason`. This is useful when you want to inspect the outcome of every task. For its generic `T`, it only supports a single type, not array or tuple types. If the return types of your functions vary, you should omit `T` or use `any`.

#### `executeAll` Example

**Core Concept:** Managing a Queue of Tasks
This example demonstrates the core functionality of the library. We will add 10 asynchronous tasks to the `executor`, which is configured with a concurrency limit of 3. The `executor` runs a maximum of 3 tasks in parallel. As one task finishes, the next one from the queue is automatically started, ensuring the concurrency limit is respected until all 10 tasks are complete.

```typescript
import { PromiseConcurrentExecutor } from '@digitalwalletcorp/promise-concurrent-executor';

// A mock async function that simulates a task with a variable delay
const asyncTask = (id: number): Promise<string> => {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * 500) + 200; // Random delay between 200ms and 700ms
    console.log(` -> Task ${id} started (delay: ${delay}ms)`);
    setTimeout(() => {
      console.log(` <- Task ${id} finished.`);
      resolve(`Result from task ${id}`);
    }, delay);
  });
};

// 1. Initialize with a concurrency of 3
const executor = new PromiseConcurrentExecutor(3);

// 2. Add 10 tasks to the queue
console.log('Adding 10 tasks to the queue...');
for (let i = 1; i <= 10; i++) {
  executor.add(() => asyncTask(i));
}

// 3. Start execution and wait for all tasks to complete
console.log(`Starting execution with concurrency=3. Queue size=${executor.size()}`);
const results = await executor.executeAll<string[]>();

console.log('\n✅ All tasks completed successfully!');
console.log('Results:', results);

/* Expected Output (the exact order of start/finish logs will vary):
Adding 10 tasks to the queue...
Starting execution with concurrency=3. Queue size=10
 -> Task 1 started (delay: ...ms)
 -> Task 2 started (delay: ...ms)
 -> Task 3 started (delay: ...ms)
 // -- At this point, 3 tasks are running. Task 4 must wait.
 <- Task 2 finished.
 -> Task 4 started (delay: ...ms) // -- Task 2 finished, so Task 4 begins.
 <- Task 1 finished.
 -> Task 5 started (delay: ...ms) // -- And so on...
 ...
 <- Task 10 finished.

✅ All tasks completed successfully!
Results: [
  'Result from task 1',
  'Result from task 2',
  'Result from task 3',
  'Result from task 4',
  'Result from task 5',
  'Result from task 6',
  'Result from task 7',
  'Result from task 8',
  'Result from task 9',
  'Result from task 10'
]
*/
```

#### Additional `executeAll` Examples

The following examples demonstrate other key features of `executeAll`, such as handling mixed return types and, importantly, its "fail-fast" error handling behavior where execution stops as soon as a task fails.

```typescript
// Example: Handling different return types using a tuple
const executor2 = new PromiseConcurrentExecutor(2);
executor2.add(async () => 'string_result');
executor2.add(async () => 123);
const results2 = await executor2.executeAll<[string, number]>();
console.log('Mixed type results:', results2); // -> ['string_result', 123]

// Example: Error handling
const executor3 = new PromiseConcurrentExecutor(2);
executor3.add(async () => 'Success');
executor3.add(async () => { throw new Error('Failure'); });
try {
  await executor3.executeAll();
} catch (error: any) {
  // executeAll rejects as soon as one promise fails.
  console.error('Execution failed:', error.message); // -> Execution failed: Failure
}
```

#### `executeAllSettled` Example

In contrast to the "fail-fast" behavior of `executeAll`, `executeAllSettled` is designed with a "run-to-completion" approach. It guarantees that every task in the queue will be executed, regardless of whether some of them fail.

The `executeAllSettled` promise itself never rejects due to task failures. Instead, it always resolves with an array of result objects, each detailing the outcome (`'fulfilled'` or `'rejected'`) of a task. This allows you to safely inspect every result, making it ideal for scenarios where comprehensive processing and reliable error logging are critical.

The following example demonstrates this by running a mix of succeeding and failing tasks.

```typescript
import { PromiseConcurrentExecutor } from '@digitalwalletcorp/promise-concurrent-executor';

// 1. Initialize with a concurrency of 3
const executor = new PromiseConcurrentExecutor(3);

// 2. Add 7 tasks that may succeed or fail
console.log('Adding 7 tasks (odd # will succeed, even # will fail)...');
for (let i = 1; i <= 7; i++) {
  executor.add(() => new Promise((resolve, reject) => {
    const delay = Math.random() * 200 + 50;
    console.log(` -> Task ${i} processing...`);
    setTimeout(() => {
      if (i % 2 !== 0) { // Succeed if 'i' is odd
        resolve(`Task ${i} Succeeded`);
      } else { // Fail if 'i' is even
        reject(new Error(`Task ${i} Failed`));
      }
    }, delay);
  }));
}

// 3. Execute and wait for all tasks to settle
console.log('\nStarting executeAllSettled...');
// The generic type <string> refers to the *fulfilled* value type.
const settledResults = await executor.executeAllSettled<string>();

console.log('\n✅ All tasks have settled.');
settledResults.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`  Task ${index + 1}: FULFILLED, Value: "${result.value}"`);
  } else {
    // result.reason is the error that was thrown
    console.error(`  Task ${index + 1}: REJECTED, Reason: ${result.reason.message}`);
  }
});

/* Expected Output (order of processing logs will vary):
Adding 7 tasks...
...
Starting executeAllSettled...
 -> Task 1 processing...
 -> Task 2 processing...
 -> Task 3 processing...
...
✅ All tasks have settled.
  Task 1: FULFILLED, Value: "Task 1 Succeeded"
  Task 2: REJECTED, Reason: Task 2 Failed
  Task 3: FULFILLED, Value: "Task 3 Succeeded"
  Task 4: REJECTED, Reason: Task 4 Failed
  Task 5: FULFILLED, Value: "Task 5 Succeeded"
  Task 6: REJECTED, Reason: Task 6 Failed
  Task 7: FULFILLED, Value: "Task 7 Succeeded"
*/
```

## 📚 API Reference

##### `new PromiseConcurrentExecutor(concurrency?: number, options?: PromiseConcurrentExecutorOption)`

* `concurrency` (optional, default: `1`): The maximum number of Promises to execute in parallel.
* `options` (optional): An object with configuration options.

```typescript
export interface PromiseConcurrentExecutorOption {
  /** Delay between checks for available concurrency (in milliseconds). Default: 100ms */
  interval?: number;
  /** Automatic execution settings */
  autoExecute?: {
    /** Type of execution: 'all' or 'allSettled' */
    type: 'all' | 'allSettled';
    /** Number of queued functions that triggers automatic execution. When the queue size reaches this threshold, all currently queued functions will be executed. */
    triggerThreshold: number;
  };
}
```

##### `add(asyncFunction: () => Promise<any>): void`

Adds an asynchronous function (wrapped in a Promise) to the execution queue.
Note: You cannot add functions while `executeAll` or `executeAllSettled` is in progress.

##### `addWithAutoExecute(asyncFunction: () => Promise<any>, options?: PromiseConcurrentExecutorOption): Promise<void>`

Adds an asynchronous function to the queue. If `autoExecute` options are set (either in constructor options or provided here), it will automatically trigger execution (`executeAll` or `executeAllSettled`) when `triggerThreshold` is met.
Important: Always `await` this function to prevent potential race conditions where execution might start while you're still adding tasks. This method does not return execution results to avoid memory pressure during automatic execution of large numbers of tasks.

##### `addAll(asyncFunctions: (() => Promise<any>[]): void`

Adds multiple asynchronous functions to the execution queue. Similar to `add`.

##### `addAllWithAutoExecute(asyncFunctions: (() => Promise<any>[]), options?: PromiseConcurrentExecutorOption): Promise<void>`

Adds multiple asynchronous functions to the queue, with potential auto-execution. Similar to `addWithAutoExecute`.

##### `executeAllSettled<T = any>(options?: PromiseConcurrentExecutorOption): Promise<PromiseSettledResult<T>[]>`

Starts the execution of all queued Promise functions. It waits for all Promises to settle (either fulfill or reject) and returns an array of `PromiseSettledResult<T>`.

##### `executeAll<T = any[]>(options?: PromiseConcurrentExecutorOption): Promise<Awaited<T>>`

Starts the execution of all queued Promise functions. It waits for all Promises to fulfill. If any Promise rejects, the entire execution will immediately reject. Returns an array of resolved values.

##### `getConcurrency(): number`

Returns the current maximum parallel execution limit.

##### `setConcurrency(concurrency: number): void`

Sets a new maximum parallel execution limit.

##### `size(): number`

Returns the number of functions currently in the queue.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.

## 🎓 Advanced Usage & Examples

This README covers the basic setup and primary usage of the library. For more advanced use cases and a comprehensive look at all features, the test suite serves as practical and up-to-date documentation.

We recommend Browse the test files to discover:
- How to handle various edge cases.
- Examples of advanced configuration options.
- Practical implementation patterns.

You can find the test case in the `/test/specs` directory of our GitHub repository.

- **[Explore our Test Suite for Advanced Examples](https://github.com/digitalwalletcorp/promise-concurrent-executor/tree/main/test/specs)**
