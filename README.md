# Promise Concurrent Executor

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Fpromise-concurrent-executor)](https://www.npmjs.com/package/@digitalwalletcorp/promise-concurrent-executor) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Fpromise-concurrent-executor)](https://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/promise-concurrent-executor/ci.yml?branch=main)](https://github.com/digitalwalletcorp/promise-concurrent-executor/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/promise-concurrent-executor.svg)](https://codecov.io/gh/digitalwalletcorp/promise-concurrent-executor)

A JavaScript library to control Promise concurrency. It processes asynchronous tasks up to a specified limit, offering queuing and automated execution. Ideal for stabilizing async operations, preventing excessive resource consumption, and improving application performance by managing the flow of API calls or data processing.

# Features

* Control Promise Async Call: Manage the maximum number of asynchronous operations running simultaneously.
* Configurable Concurrency: Easily set how many processes can run at the same time.
* Dynamic Task Addition: Add new Promise functions to the queue even while execution is in progress (though add and addWithAutoExecute have limitations for isRunning state).

# Installation

```bash
npm install @digitalwalletcorp/promise-concurrent-executor
# or
yarn add @digitalwalletcorp/promise-concurrent-executor
```

# Usage

The `PromiseConcurrentExecutor` helps you manage a queue of asynchronous tasks, ensuring that only a specified number run in parallel. You can add tasks to the queue and then trigger their execution using `executeAll` or `executeAllSettled`.

### `executeAll` vs. `executeAllSettled`

Both methods execute all queued Promise functions, but they handle rejected Promises differently:

* `executeAll<T>()`: Similar to `Promise.all()`, this method starts all queued Promise functions and awaits their completion. If any of the Promises reject, `executeAll` will immediately reject with the reason of the first Promise that failed. The return type supports array or tuple types for its generic `T`.
* `executeAllSettled<T>()`: Similar to `Promise.allSettled()`, this method executes all queued Promise functions regardless of whether they succeed or fail. It always returns an array of `PromiseSettledResult` objects, where each object indicates the status (`'fulfilled'` or `'rejected'`) and the `value` or `reason`. This is useful when you want to inspect the outcome of every task. For its generic `T`, it only supports a single type, not array or tuple types. If the return types of your functions vary, you should omit `T` or use `any`.

#### `executeAll` Example

This example shows how `executeAll` behaves when one of the tasks rejects, causing the entire execution to fail. The generic type `T` here can be an array or tuple type, reflecting the expected order of results if all promises fulfill.

```typescript
import { PromiseConcurrentExecutor } from '@digitalwalletcorp/promise-concurrent-executor';

// A mock async function for demonstration
const someHeavyFunction = (id: number, value: any): Promise<any> =>
  new Promise(resolve => setTimeout(() => {
    console.log(`Processing task ${id}`);
    resolve(value);
  }, 100));


// Example 1: Basic usage with a consistent return type
const executor1 = new PromiseConcurrentExecutor(3); // Allow 3 concurrent processes.
executor1.add(async () => someHeavyFunction(100, 'aaa'));
executor1.add(async () => someHeavyFunction(101, 'bbb'));
executor1.add(async () => someHeavyFunction(102, 'ccc'));

console.log('Starting executeAll (Basic)...');
const results1 = await executor1.executeAll<string[]>(); // Starts execution and waits for all to complete. Errors will immediately terminate.
console.log('Results (Basic):', results1);
// Expected results: ['aaa', 'bbb', 'ccc']


// Example 2: Handling different return types using a tuple
const executor2 = new PromiseConcurrentExecutor(3); // Allow 3 concurrent processes.
executor2.add(async () => someHeavyFunction(200, 'string_result'));
executor2.add(async () => someHeavyFunction(201, 123));
executor2.add(async () => someHeavyFunction(202, { key: 'value', num: 456 }));

console.log('\nStarting executeAll (Mixed Types)...');
const results2 = await executor2.executeAll<[string, number, { key: string; num: number }]>(); // Tuple type allows defining each return type
console.log('Results (Mixed Types):', results2);
// Expected results: ['string_result', 123, { key: 'value', num: 456 }]


// Example 3: Error handling with executeAll
const executor3 = new PromiseConcurrentExecutor(2); // Allow 2 concurrent processes.
executor3.add(async () => new Promise(resolve => setTimeout(() => {
  resolve('First task (success)');
}, 100)));

executor3.add(async () => new Promise((_, reject) => setTimeout(() => {
  reject(new Error('Second task (failure)')); // This task will reject
}, 50))); // Shorter delay to ensure it rejects earlier

executor3.add(async () => new Promise(resolve => setTimeout(() => {
  resolve('Third task (success)');
}, 150)));

try {
  console.log('\nStarting executeAll (Error Handling)...');
  const results3 = await executor3.executeAll<string[]>();
  console.log('All tasks fulfilled:', results3); // This line will NOT be reached if any promise rejects
} catch (error: any) {
  console.error('ExecuteAll rejected because one or more promises failed:', error.message);
}

/* Expected Output (order may vary due to concurrency for console.log from someHeavyFunction):
Starting executeAll (Basic)...
Processing task 100
Processing task 101
Processing task 102
Results (Basic): [ 'aaa', 'bbb', 'ccc' ]

Starting executeAll (Mixed Types)...
Processing task 200
Processing task 201
Processing task 202
Results (Mixed Types): [ 'string_result', 123, { key: 'value', num: 456 } ]

Starting executeAll (Error Handling)...
ExecuteAll rejected because one or more promises failed: Second task (failure)
*/
```

#### `executeAllSettled` Example

This example demonstrates how to use `executeAllSettled` to run tasks concurrently and get all results, including those from rejected Promises. Notice how the generic type `T` applies to the individual resolved values, and the method always returns an array of `PromiseSettledResult`.

```typescript
import { PromiseConcurrentExecutor } from '@digitalwalletcorp/promise-concurrent-executor';

// A mock async function for demonstration
const someHeavyFunction = (id: number, value: any): Promise<any> =>
  new Promise(resolve => setTimeout(() => {
    console.log(`Processing task ${id}`);
    resolve(value);
  }, 100));


// Example 1: Basic usage with a consistent return type
const executor1 = new PromiseConcurrentExecutor(3); // Allow 3 concurrent processes.
executor1.add(async () => someHeavyFunction(100, 'aaa'));
executor1.add(async () => someHeavyFunction(101, 'bbb'));
executor1.add(async () => someHeavyFunction(102, 'ccc'));

console.log('Starting executeAllSettled (Basic)...');
const results1 = await executor1.executeAllSettled<string>(); // Starts execution of all functions and waits for completion.
results1.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Basic Result ${index}: FULFILLED - ${result.value}`);
  } else {
    console.error(`Basic Result ${index}: REJECTED - ${result.reason.message}`);
  }
});
// Expected results:
// Basic Result X: FULFILLED - aaa
// Basic Result Y: FULFILLED - bbb
// Basic Result Z: FULFILLED - ccc


// Example 2: Handling fulfilled and rejected promises
const executor2 = new PromiseConcurrentExecutor(3); // Allow 3 concurrent processes.

for (let i = 0; i < 5; i++) {
  executor2.add(async () => {
    return new Promise((resolve, reject) => {
      const delay = Math.random() * 200 + 50;
      setTimeout(() => {
        if (i % 2 === 0) { // Simulate some tasks succeeding, some failing
          resolve(`Task ${i} succeeded`);
        } else {
          reject(new Error(`Task ${i} failed`));
        }
      }, delay);
    });
  });
}

console.log('\nStarting executeAllSettled (With Errors)...');
// T is a single type, e.g., 'string' for resolved values.
const results2 = await executor2.executeAllSettled<string>();

results2.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`Error Handling Result ${index}: FULFILLED - ${result.value}`);
  } else {
    console.error(`Error Handling Result ${index}: REJECTED - ${result.reason.message}`);
  }
});

/* Expected Output (order may vary due to concurrency):
Starting executeAllSettled (Basic)...
Processing task 100
Processing task 101
Processing task 102
Basic Result X: FULFILLED - aaa
Basic Result Y: FULFILLED - bbb
Basic Result Z: FULFILLED - ccc

Starting executeAllSettled (With Errors)...
Processing task 0
Processing task 1
Processing task 2
Processing task 3
Processing task 4
Error Handling Result X: FULFILLED - Task 0 succeeded
Error Handling Result Y: REJECTED - Task 1 failed
Error Handling Result Z: FULFILLED - Task 2 succeeded
Error Handling Result A: REJECTED - Task 3 failed
Error Handling Result B: FULFILLED - Task 4 succeeded
*/
```

# API Reference

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

# License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.

## Advanced Usage & Examples

This README covers the basic setup and primary usage of the library. For more advanced use cases and a comprehensive look at all features, the test suite serves as practical and up-to-date documentation.

We recommend Browse the test files to discover:
- How to handle various edge cases.
- Examples of advanced configuration options.
- Practical implementation patterns.

You can find the test case in the `/test/specs` directory of our GitHub repository.

- **[Explore our Test Suite for Advanced Examples](https://github.com/digitalwalletcorp/promise-concurrent-executor/tree/main/test/specs)**
