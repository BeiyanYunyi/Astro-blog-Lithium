const svgNameReg = /[. \w-]+(?=\.svg)/;

const svgPathToName = (path: string) => svgNameReg.exec(path)![0];

export default svgPathToName;
