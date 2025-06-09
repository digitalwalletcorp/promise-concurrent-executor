export interface PromiseConcurrentExecutorOption {
  /** 関数の待機時間. 未指定の場合は100ms */
  interval?: number;
  /** 自動実行 */
  autoExecute?: {
    /** 実行するタイプ. executeAll / executeAllSettled */
    type: 'all' | 'allSettled',
    /** 自動実行する件数. キューのサイズがこの件数に到達した時点でキューに登録されている関数をすべて実行する */
    triggerThreshold: number
  };
}

/**
 * 指定した並列実行数を最大としてPromiseを実行する。
 * 実行中の処理が１つ終わるとスタックに積まれている処理を１つ実行に移す。
 * このクラスに処理を追加する場合、Promiseでラップして引き渡す。
 * executeAll() / executeAllSettled() を呼ぶことで処理を開始し、完了後の結果を受け取る。
 * executeAll() / executeAllSettled() を呼び出すまでは関数が実行されない。
 */
export class PromiseConcurrentExecutor {

  /** 並列実行数 */
  private concurrency: number;
  /** コンストラクタオプション */
  private options: PromiseConcurrentExecutorOption;
  /** 実行一覧 */
  private queue: (() => Promise<any>)[] = [];
  /** 現在実行数 */
  private runningCount = 0;
  /** 実行中フラグ */
  private isRunning = false;

  /**
   * コンストラクタ
   *
   * @param {number} [concurrency]
   * @param {PromiseConcurrentExecutorOption} [options]
   */
  constructor(concurrency?: number, options?: PromiseConcurrentExecutorOption) {
    this.concurrency = concurrency || 1;
    this.options = options || {};
    this.init();
  }

  /**
   * フィールド初期化
   */
  private init() {
    this.queue.length = 0;
    this.isRunning = false;
    this.runningCount = 0; // これは明示的に実行しなくても処理完了時には0になる
  }

  /**
   * 並列実行数を返す
   *
   * @returns {number}
   */
  public getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * 並列実行数を設定する
   *
   * @param {number} concurrency
   */
  public setConcurrency(concurrency: number): void {
    this.concurrency = concurrency;
  }

  /**
   * 実行一覧に登録されている処理の数を返す
   *
   * @returns {number}
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * 処理を追加する
   *
   * @param {() => Promise<any>} asyncFunction
   */
  public add(asyncFunction: () => Promise<any>): void {
    if (this.isRunning) {
      throw new Error('Cannot add any processes while execution is in progress.');
    }
    this.queue.push(asyncFunction);
  }

  /**
   * 処理を追加する
   * options.autoExecuteAllまたはautoExecuteSyncに指定がある場合、
   * キューに追加された値が指定した値に達した場合、自動的に処理を開始する
   *
   * この関数をawaitせずに呼び出した場合、処理の実行とキューへの追加がバッティングしてエラーがスローされる可能性がある
   * この関数を呼び出すときには必ずawaitをすること
   *
   * 自動的に処理を行う場合は大量の処理が要求される可能性があることからレスポンス情報を保持するとメモリを圧迫する恐れがあるため、処理結果は返却しない
   *
   * @param {() => Promise<T>} asyncFunction
   * @param {PromiseConcurrentExecutorOption} [options]
   */
  public async addWithAutoExecute(asyncFunction: () => Promise<any>, options?: PromiseConcurrentExecutorOption): Promise<void> {
    this.queue.push(asyncFunction);
    const autoExecute = options?.autoExecute || this.options.autoExecute;
    if (autoExecute != null && autoExecute.triggerThreshold <= this.queue.length) {
      switch (autoExecute.type) {
        case 'all':
          await this.executeAll(options);
          break;
        case 'allSettled':
          await this.executeAllSettled(options);
          break;
        default:
      }
    }
  }

  /**
   * 処理を追加する
   *
   * @param {(() => Promise<any>)[]} asyncFunctions
   */
  public addAll(asyncFunctions: (() => Promise<any>)[]): void {
    for (let i = 0; i < asyncFunctions.length; i++) {
      this.add(asyncFunctions[i]);
    }
  }

  /**
   * 処理を追加する
   * options.autoExecuteAllまたはautoExecuteSyncに指定がある場合、
   * キューに追加された値が指定した値に達した場合、自動的に処理を開始する
   *
   * この関数をawaitせずに呼び出した場合、処理の実行とキューへの追加がバッティングしてエラーがスローされる可能性がある
   * この関数を呼び出すときには必ずawaitをすること
   *
   * 自動的に処理を行う場合は大量の処理が要求される可能性があることからレスポンス情報を保持するとメモリを圧迫する恐れがあるため、処理結果は返却しない
   *
   * @param {(() => Promise<any>)[]} asyncFunctions
   * @param {PromiseConcurrentExecutorOption} [options]
   */
  public async addAllWithAutoExecute(asyncFunctions: (() => Promise<any>)[], options?: PromiseConcurrentExecutorOption): Promise<void> {
    for (let i = 0; i < asyncFunctions.length; i++) {
      await this.addWithAutoExecute(asyncFunctions[i], options);
    }
  }

  /**
   * すべての処理の実行を開始し、完了後の結果を返却する
   * 呼び出し中にエラーが発生してもすべての処理を実行する
   * 呼び出しエラーになったかどうかの判別は PromiseSettledResult.status により行う。
   * この関数は返却値をPromiseSettledResultの配列で返す
   * Genericsの型は単一の型のみサポートし、配列やタプル型は指定不可
   * 返却の型が異なる場合はGenericsを未指定にするかanyを指定する。個別の型定義については未サポート
   *
   * @param {PromiseConcurrentExecutorOption} [options]
   * @returns {{Promise<PromiseSettledResult<T>>[]}}
   */
  public async executeAllSettled<T = any>(options?: PromiseConcurrentExecutorOption): Promise<PromiseSettledResult<T>[]> {
    if (this.isRunning) {
      throw new Error('Execution is already in progress.');
    }
    try {
      this.isRunning = true;
      // Promise.allSettledの中で関数の実行を行うことで Proise.allSettled から UnhandledPromiseRejectionWarning が出力されることを回避できる
      // https://stackoverflow.com/questions/67502527/unhandled-promise-rejection-with-promise-allsettled-and-try-catch
      const results = await Promise.allSettled<T>(this.queue.map(async promise => {
        return await this.execute<T>(promise, options);
      }));
      return results as PromiseSettledResult<T>[];
    } finally {
      this.init();
    }
  }

  /**
   * すべての処理の実行を開始し、完了後の結果を返却する
   * 呼び出し中にエラーが発生した場合は即座にエラーを送出する。
   * この関数は返却値をタプル型で返す
   * Genericsの型は配列またはタプル型をサポートする
   *
   * @param {PromiseConcurrentExecutorOption} [options]
   * @returns {{Promise<Awaited<T>>}}
   */
  public async executeAll<T = any[]>(options?: PromiseConcurrentExecutorOption): Promise<Awaited<T>> {
    if (this.isRunning) {
      throw new Error('Execution is already in progress.');
    }
    try {
      this.isRunning = true;
      const results = await Promise.all<T>(this.queue.map(async promise => {
        return await this.execute<T>(promise, options);
      }));
      return results as Awaited<T>;
    } finally {
      this.init();
    }
  }

  /**
   * 処理を実行する
   *
   * @param {() => Promise<T>} promise
   * @param {PromiseConcurrentExecutorOption} [options]
   * @returns {Promise<T>}
   */
  private async execute<T>(promise: () => Promise<T>, options?: PromiseConcurrentExecutorOption): Promise<T> {
    // 自身が流量制限チェックを通過して実行可能状態になるまで待機
    await this.wait(options);
    return new Promise<T>(async (resolve, reject) => {
      // ここで初めて関数の実行を行う
      try {
        const result = await promise();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.runningCount--;
      }
    });
  }

  /**
   * 実行ができる状態になるまで待機する
   * ・流量制限にひっかからない
   *
   * @param {PromiseConcurrentExecutorOption} [options]
   * @returns {{Promise<void>}}
   */
  private async wait(options?: PromiseConcurrentExecutorOption): Promise<void> {
    return new Promise<void>(resolve => {
      const interval = options?.interval || this.options.interval || 100;
      const intervalId = setInterval(() => {
        // if文の中で条件判定とカウンターのインクリメントを行うことで、想定外の流量が発生することを回避
        if (this.runningCount < this.concurrency // 流量制限に引っかからない
            && this.runningCount++ != null // 条件を満たしたら実行数をインクリメント
        ) {
          resolve();
          clearInterval(intervalId);
        }
      }, interval);
    });
  }
}
