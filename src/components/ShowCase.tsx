import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';

const ShowCase: Component = () => {
  const [count, setCount] = createSignal(0);
  return (
    <div class="card p-4">
      <p>
        例如，这是一个使用 solid.js 实现的计数器，而我在博文里
        <a
          target="blank"
          href="https://github.com/lixiang810/comb/blob/main/src/pages/posts/removeHexo.mdx?plain=1#L10"
        >
          只用一行代码
        </a>
        就引入了它。你可以点击下面的两个按钮查看效果。
      </p>
      <p class="text-center text-lg">{count()}s</p>
      <div class="flex gap-2 justify-center">
        <button
          class="rounded-md transition-all no-underline hover:shadow-md outline-neutral-200 dark:outline-neutral-600 outline outline-1 p-2"
          onClick={() => {
            setCount((c) => c - 1);
          }}
        >
          -1s
        </button>
        <button
          class="rounded-md transition-all no-underline hover:shadow-md outline-neutral-200 dark:outline-neutral-600 outline outline-1 p-2"
          onClick={() => {
            setCount((c) => c + 1);
          }}
        >
          +1s
        </button>
      </div>
    </div>
  );
};

export default ShowCase;
