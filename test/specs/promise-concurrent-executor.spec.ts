import { PromiseConcurrentExecutor } from '@/promise-concurrent-executor';

type WiatFunctionType = 'resolve' | 'reject';

const waitFunction = async (type: WiatFunctionType, msec: number): Promise<number> => {
  console.log('waitFunction start', type, msec);
  return new Promise<number>((resolve, reject) =>
    setTimeout(() => {
      switch (type) {
        case 'resolve':
          resolve(msec);
          break;
        case 'reject':
          reject(msec);
          break;
        default:
      }
      console.log('waitFunction end', type, msec);
    }, msec)
  );
};

describe('@/promise-concurrent-executor.ts', () => {
  describe('executeAllSettled', () => {
    it('executeAllSettled.01', async () => {
      // 同時実行数未指定 = 1
      const executor = new PromiseConcurrentExecutor();
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      const start = performance.now();
      const results = await executor.executeAllSettled<number>({
        interval: 10
      });
      const end = performance.now();
      expect(results.length).toBe(5);
      expect(results).toEqual([
        {
          status: 'fulfilled',
          value: 100
        },
        {
          status: 'fulfilled',
          value: 100
        },
        {
          status: 'fulfilled',
          value: 100
        },
        {
          status: 'fulfilled',
          value: 100
        },
        {
          status: 'fulfilled',
          value: 100
        }
      ]);
      // 500ms〜600msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(500);
      expect(executionTime).toBeLessThan(600);
    });
    it('executeAllSettled.02', async () => {
      // 同時実行数未指定 = 3
      // 流量の管理が正しく行われていることの確認
      const executor = new PromiseConcurrentExecutor(3);
      executor.addAll([
        async () => waitFunction('resolve', 1000), // -> 最初に実行されて最初に終了する
        async () => waitFunction('resolve', 2000), // -> 2番目に実行されて3番目に終了する
        async () => waitFunction('resolve', 3000), // -> 3番目に実行されて5番目に終了する
        async () => waitFunction('resolve', 500), // -> 4番目に実行されて2番目に終了する
        async () => waitFunction('resolve', 550) // -> 5番目に実行されて4番目に終了する
      ]);
      const start = performance.now();
      const results = await executor.executeAllSettled<number>();
      const end = performance.now();
      expect(results.length).toBe(5);
      expect(results).toEqual([
        {
          status: 'fulfilled',
          value: 1000
        },
        {
          status: 'fulfilled',
          value: 2000
        },
        {
          status: 'fulfilled',
          value: 3000
        },
        {
          status: 'fulfilled',
          value: 500
        },
        {
          status: 'fulfilled',
          value: 550
        }
      ]);
      // 3000ms〜3500msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(3000);
      expect(executionTime).toBeLessThan(3500);
    });
    it('executeAllSettled.03', async () => {
      // rejectされる関数を含む
      const executor = new PromiseConcurrentExecutor(3);
      executor.add(async () => waitFunction('resolve', 1000));
      executor.add(async () => waitFunction('reject', 1001));
      executor.add(async () => waitFunction('resolve', 1002));
      executor.add(async () => waitFunction('reject', 1003));
      executor.add(async () => waitFunction('resolve', 1004));
      const start = performance.now();
      const results = await executor.executeAllSettled<number>();
      const end = performance.now();
      expect(results.length).toBe(5);
      expect(results).toEqual([
        {
          status: 'fulfilled',
          value: 1000
        },
        {
          status: 'rejected',
          reason: 1001
        },
        {
          status: 'fulfilled',
          value: 1002
        },
        {
          status: 'rejected',
          reason: 1003
        },
        {
          status: 'fulfilled',
          value: 1004
        }
      ]);
      // 2000ms〜2500msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(2000);
      expect(executionTime).toBeLessThan(2500);
    });
    it('executeAllSettled.04', async () => {
      // executeAllSettled()呼び出し後の再実行
      const executor = new PromiseConcurrentExecutor(3);
      executor.add(async () => waitFunction('resolve', 1000));
      executor.add(async () => waitFunction('reject', 1001));
      executor.add(async () => waitFunction('resolve', 1002));
      executor.add(async () => waitFunction('reject', 1003));
      executor.add(async () => waitFunction('resolve', 1004));
      // 1回目
      const start = performance.now();
      const results1 = await executor.executeAllSettled<number>();
      const end = performance.now();
      expect(results1.length).toBe(5);
      expect(results1).toEqual([
        {
          status: 'fulfilled',
          value: 1000
        },
        {
          status: 'rejected',
          reason: 1001
        },
        {
          status: 'fulfilled',
          value: 1002
        },
        {
          status: 'rejected',
          reason: 1003
        },
        {
          status: 'fulfilled',
          value: 1004
        }
      ]);
      // 2000ms〜2500msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(2000);
      expect(executionTime).toBeLessThan(2500);

      executor.add(async () => waitFunction('reject', 1000));
      executor.add(async () => waitFunction('reject', 1001));
      executor.add(async () => waitFunction('resolve', 1002));
      executor.add(async () => waitFunction('resolve', 1003));
      executor.add(async () => waitFunction('resolve', 1004));
      // 2回目
      const results2 = await executor.executeAllSettled<number>();
      expect(results2.length).toBe(5);
      expect(results2).toEqual([
        {
          status: 'rejected',
          reason: 1000
        },
        {
          status: 'rejected',
          reason: 1001
        },
        {
          status: 'fulfilled',
          value: 1002
        },
        {
          status: 'fulfilled',
          value: 1003
        },
        {
          status: 'fulfilled',
          value: 1004
        }
      ]);
      // 関数を追加せずに3回目
      const results3 = await executor.executeAllSettled<number>();
      expect(results3.length).toBe(0);
    });
    it('executeAllSettled.05', async () => {
      // 戻り値の異なるPromiseの同時実行
      const func1 = (msec: number): Promise<number> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(msec);
          }, msec)
        );

      const func2 = (): Promise<string> =>
        new Promise((_, reject) =>
          setTimeout(() => {
            reject('reject');
          }, 100)
        );

      const func3 = (e: Error): Promise<Error> =>
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(e);
          }, 100)
        );

      const executor = new PromiseConcurrentExecutor();
      const error = new Error('error message');
      executor.addAll([
        async () => func1(100),
        async () => func2(),
        async () => func3(error)
      ]);
      // 返却の型が混在する場合はanyしか指定できない
      const results = await executor.executeAllSettled<any>({
        interval: 10
      });
      expect(results.length).toBe(3);
      expect(results).toEqual([
        {
          status: 'fulfilled',
          value: 100
        },
        {
          status: 'rejected',
          reason: 'reject'
        },
        {
          status: 'rejected',
          reason: error
        }
      ]);
    });
    it('executeAllSettled.06', async () => {
      // Genericsがvoid
      const func1 = (msec: number): Promise<void> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve();
          }, msec)
        );

      const func2 = (): Promise<void> =>
        new Promise((_, reject) =>
          setTimeout(() => {
            reject();
          }, 100)
        );

      const executor = new PromiseConcurrentExecutor(3);
      executor.addAll([
        async () => func1(100),
        async () => func2(),
        async () => func1(100)
      ]);
      const results = await executor.executeAllSettled<void>();
      expect(results.length).toBe(3);
      expect(results).toEqual([
        {
          status: 'fulfilled',
          value: undefined
        },
        {
          status: 'rejected',
          reason: undefined
        },
        {
          status: 'fulfilled',
          value: undefined
        }
      ]);
    });
    it('executeAllSettled.07', async () => {
      // 関数を設定せずにexecuteAllSettled呼び出し
      const executor = new PromiseConcurrentExecutor(10);
      const results = await executor.executeAllSettled();
      expect(results).toEqual([]);
    });
  });

  describe('executeAll', () => {
    it('executeAll.01', async () => {
      // 同時実行数未指定 = 1
      const executor = new PromiseConcurrentExecutor();
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      executor.add(async () => waitFunction('resolve', 100));
      const start = performance.now();
      const results = await executor.executeAll<number[]>({
        interval: 10
      });
      const end = performance.now();
      expect(results.length).toBe(5);
      expect(results).toEqual([
        100,
        100,
        100,
        100,
        100
      ]);
      // 500ms〜600msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(500);
      expect(executionTime).toBeLessThan(600);
    });
    it('executeAll.02', async () => {
      // 同時実行数未指定 = 3
      const executor = new PromiseConcurrentExecutor(3);
      executor.addAll([
        async () => waitFunction('resolve', 1000),
        async () => waitFunction('resolve', 1001),
        async () => waitFunction('resolve', 1002),
        async () => waitFunction('resolve', 1003),
        async () => waitFunction('resolve', 1004)
      ]);
      const start = performance.now();
      const results = await executor.executeAll<number[]>();
      const end = performance.now();
      expect(results.length).toBe(5);
      expect(results).toEqual([
        1000,
        1001,
        1002,
        1003,
        1004
      ]);
      // 2000ms〜2500msで終了したことの確認
      const executionTime = end - start;
      console.log('executionTime', executionTime);
      expect(executionTime).toBeGreaterThan(2000);
      expect(executionTime).toBeLessThan(2500);
    });
    it('executeAll.03', async () => {
      // rejectされる関数を含む
      try {
        const executor = new PromiseConcurrentExecutor(3);
        executor.add(async () => waitFunction('resolve', 1000));
        executor.add(async () => waitFunction('reject', 1001));
        executor.add(async () => waitFunction('resolve', 1002));
        executor.add(async () => waitFunction('reject', 1003));
        executor.add(async () => waitFunction('resolve', 1004));
        await executor.executeAll<number[]>();
        throw new Error('No errors detected.');
      } catch (error) {
        expect(error).toBe(1001);
      }
    });
    it('executeAll.04', async () => {
      // executeAll()呼び出し後の再実行
      const executor = new PromiseConcurrentExecutor(3);
      executor.add(async () => waitFunction('resolve', 1000));
      executor.add(async () => waitFunction('resolve', 1002));
      executor.add(async () => waitFunction('resolve', 1004));
      // 1回目
      const results1 = await executor.executeAll<number[]>();
      expect(results1.length).toBe(3);
      expect(results1).toEqual([
        1000,
        1002,
        1004
      ]);

      executor.add(async () => waitFunction('resolve', 1002));
      executor.add(async () => waitFunction('resolve', 1003));
      executor.add(async () => waitFunction('resolve', 1004));
      // 2回目
      const results2 = await executor.executeAll<number[]>();
      expect(results2.length).toBe(3);
      expect(results2).toEqual([
        1002,
        1003,
        1004
      ]);
      // 関数を追加せずに3回目
      const results3 = await executor.executeAll();
      expect(results3.length).toBe(0);
    });
    it('executeAll.05', async () => {
      // 戻り値の異なるPromiseの同時実行
      const func1 = (msec: number): Promise<number> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(msec);
          }, msec)
        );

      const func2 = (): Promise<string> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve('resolve');
          }, 100)
        );

      const func3 = (e: Error): Promise<Error> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(e);
          }, 100)
        );

      const executor = new PromiseConcurrentExecutor();
      const error = new Error('error message');
      executor.addAll([
        async () => func1(100),
        async () => func2(),
        async () => func3(error)
      ]);
      const [f1, f2, f3] = await executor.executeAll<[number, string, Error]>({
        interval: 10
      });
      expect(typeof f1).toBe('number');
      expect(typeof f2).toBe('string');
      expect(typeof f3).toBe('object');
      expect(f1).toBe(100);
      expect(f2).toBe('resolve');
      expect(f3).toEqual(error);
    });
    it('executeAll.06', async () => {
      // Genericsがvoid
      const func1 = (msec: number): Promise<void> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve();
          }, msec)
        );

      const func2 = (): Promise<void> =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve();
          }, 100)
        );

      const executor = new PromiseConcurrentExecutor(3);
      executor.addAll([
        async () => func1(100),
        async () => func2(),
        async () => func1(100)
      ]);
      const results = await executor.executeAll<void[]>();
      expect(results.length).toBe(3);
      expect(results).toEqual([
        undefined,
        undefined,
        undefined
      ]);
    });
    it('executeAll.07', async () => {
      // 関数を設定せずにexecuteAll呼び出し
      const executor = new PromiseConcurrentExecutor(10);
      const results = await executor.executeAll();
      expect(results).toEqual([]);
    });
  });
  describe('addWithAutoExecute', () => {
    it('addWithAutoExecute.01', async () => {
      const executor = new PromiseConcurrentExecutor(5);
      for (let i = 1; i <= 10; i++) {
        await executor.addWithAutoExecute(async () => waitFunction('resolve', 100), {
          interval: 10,
          autoExecute: {
            type: 'all',
            triggerThreshold: 4
          }
        });
        if (i % 4 === 0) {
          expect(executor.size()).toBe(0);
        } else {
          expect(executor.size()).toBe(i % 4);
        }
      }
      expect(executor.size()).toBe(2); // 4件ずつ実行されて2件余る
    });
  });
  describe('addAllWithAutoExecute', () => {
    it('addAllWithAutoExecute.01', async () => {
      const executor = new PromiseConcurrentExecutor(5);
      await executor.addAllWithAutoExecute([...Array(10)].map(() => async () => waitFunction('resolve', 100)), {
        interval: 10,
        autoExecute: {
          type: 'allSettled',
          triggerThreshold: 4
        }
      });
      expect(executor.size()).toBe(2); // 4件ずつ実行されて2件余る
    });
    it('addAllWithAutoExecute.02', async () => {
      const executor = new PromiseConcurrentExecutor(5);
      await executor.addAllWithAutoExecute([...Array(10)].map(() => async () => waitFunction('reject', 100)), {
        interval: 10,
        autoExecute: {
          type: 'allSettled',
          triggerThreshold: 4
        }
      });
      // executeAllSettledの場合は処理中にエラーが起きてもエラーは返らない。結果についても取得不可
    });
    it('addAllWithAutoExecute.03', async () => {
      const executor = new PromiseConcurrentExecutor(5);
      try {
        await executor.addAllWithAutoExecute([...Array(10)].map((_, i) => async () => waitFunction('reject', 100 + i)), {
          interval: 10,
          autoExecute: {
            type: 'all',
            triggerThreshold: 1
          }
        });
        throw new Error('No errors detected');
      } catch (error) {
        // executeAllの場合は処理中にエラーが起きるとエラーが返る
        expect(error).toBe(100); // 最初の1件でエラーが起きるので、エラー情報は100になる
      }
    });
  });
});
