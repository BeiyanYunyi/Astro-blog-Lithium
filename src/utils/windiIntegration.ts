const windiIntegration = () => {
  return {
    name: 'windi',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig }) => {},
    },
  };
};

export default windiIntegration;
