const shuffle = <T>(arr: T[]) => {
  let l = arr.length;
  const brr = [...arr];
  while (l > 0) {
    const index = Math.floor(Math.random() * l);
    const temp = brr[l - 1];
    brr[l - 1] = brr[index]!;
    brr[index] = temp!;
    l -= 1;
  }
  return brr;
};

export default shuffle;
