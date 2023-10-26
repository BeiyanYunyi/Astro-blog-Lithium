export const GET = () =>
  new Response(
    JSON.stringify({
      subject: 'acct:BeiyanYunyi@blog.yunyi.beiyan.us',
      aliases: ['https://blog.yunyi.beiyan.us', 'https://stblog.penclub.club'],
      links: [
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: 'https://blog.yunyi.beiyan.us/intro',
        },
        { rel: 'self', type: 'application/activity+json', href: 'https://blog.yunyi.beiyan.us' },
        // {
        //   rel: 'http://ostatus.org/schema/1.0/subscribe',
        //   template: '',
        // },
        {
          rel: 'http://webfinger.net/rel/avatar',
          type: 'image/png',
          href: 'https://blog.yunyi.beiyan.us/头像方.png',
        },
      ],
    }),
    { headers: { 'Content-Type': 'application/jrd+json' } },
  );
