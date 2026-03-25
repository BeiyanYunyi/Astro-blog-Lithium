import type { Component } from 'solid-js';
import { createSignal } from 'solid-js';

const ShowCase: Component = () => {
  const [count, setCount] = createSignal(0);
  return (
    <div class="card p-4">
      <p>
        例如，这是一个使用solid.js实现的计数器，而我在博文里
        <a
          target="blank"
          href="https://github.com/BeiyanYunyi/Astro-Blog-Lithium/blob/main/src/content/posts/removeHexo.mdx?plain=1#L10"
        >
          只用一行代码
        </a>
        就引入了它。你可以点击下面的两个按钮查看效果。
      </p>
      <p class="text-center text-lg">{count()}s</p>
      <div class="flex justify-center gap-2">
        <button
          class="rounded-md p-2 no-underline outline-1 outline-neutral-200 outline transition-all hover:shadow-md dark:outline-neutral-600"
          onClick={() => {
            setCount((c) => c - 1);
          }}
        >
          -1s
        </button>
        <button
          class="rounded-md p-2 no-underline outline-1 outline-neutral-200 outline transition-all hover:shadow-md dark:outline-neutral-600"
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
