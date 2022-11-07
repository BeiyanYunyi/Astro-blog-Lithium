import type { Component } from 'solid-js';
import { For } from 'solid-js';
import friends from '../../data/friends.json';
import shuffle from './shuffle';

const Friends: Component = () => {
  const [dustella, ...toshuffle] = friends;
  const friendRenderList = [dustella!, ...shuffle(toshuffle)];
  return (
    <div class="flex flex-col gap-2 not-prose ">
      <For each={friendRenderList}>
        {(friend) => (
          <a
            href={friend.url}
            class="hover:underline transition-all no-underline hover:shadow-md outline-neutral-200 dark:outline-neutral-600 outline outline-1"
          >
            <div class="p-2 ">
              <div class="flex gap-2">
                <img height="75" width="75" src={friend.avatar} class="$style.avatar" />

                <div class="$style.cardLayer2">
                  <div class="$style.title">{friend.title}</div>
                  <div class="$style.content">{friend.description}</div>
                </div>
              </div>
            </div>
          </a>
        )}
      </For>
    </div>
  );
};

export default Friends;
