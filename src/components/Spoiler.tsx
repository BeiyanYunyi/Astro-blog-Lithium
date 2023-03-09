import { ParentComponent, createSignal, Show } from 'solid-js';

const Spoiler: ParentComponent<{ information?: string }> = (props) => {
  const [show, setShow] = createSignal(false);
  return (
    <div>
      <button
        class="text-start"
        onClick={(e) => {
          e.preventDefault();
          setShow(!show());
        }}
      >
        {props.information || 'Spoiler'}
      </button>
      <div
        onClick={(e) => {
          e.preventDefault();
          setShow(true);
        }}
        classList={{ 'cursor-pointer': !show() }}
      >
        <div
          classList={{ 'filter-blur pointer-events-none select-none': !show() }}
          class="transition"
        >
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default Spoiler;
