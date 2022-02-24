---
title: 模块化你的GraphQL Schema代码
date: 2021-04-04 11:00:00
tag: [教程]
description: >
  随着 GraphQL 应用程序从演示、概念验证到生产的发展，Schema 和 resolver 的复杂性也会随之增长。为了组织代码，我们可能需要将 schema type 和相关的 resolver 分割成多个文件。
---

随着 GraphQL 应用程序从演示、概念验证到生产的发展，Schema 和 resolver 的复杂性也会随之增长。为了组织代码，我们可能需要将 schema type 和相关的 resolver 分割成多个文件。<!--more-->

我们经常收到这样的问题，因为有很多不同的方法来拆分 schema 代码，而且也许看起来你需要复杂的设置来获得好的结果。但事实证明，只需要几个简单的 JavaScript 概念，就可以将 schema 和 resolver 代码分离到单独的文件中。

在这篇文章中，我们介绍了一种直接的方法，对用 `graphql-tools`构建的 schema 进行模块化，你可以进行调整，以适应自己的喜好和代码库的风格。

## Schema

如果你刚刚起步，并且在一个文件中定义了你的整个Schema，它可能看起来很像下面的片段。在这里，我们称它为`schema.js`。

```js
// schema.js

const typeDefs = `
  type Query {
    author(id: Int!): Post
    book(id: Int!): Post
  }  

  type Author {
    id: Int!
    firstName: String
    lastName: String
    books: [Book]
  }  

  type Book {
    title: String
    author: Author
  }
`;

makeExecutableSchema({
  typeDefs: typeDefs,
  resolvers: {},
});
```

理想情况下，我们不想把所有的东西都放在一个schema定义字符串里，而想把`Author`和`Book`的schema类型分别放在名为`author.js`和`book.js`的文件中。

我们在Schema定义语言（SDL）中编写的schema定义只是字符串。对它们，我们有一个简单的方法来导入不同文件中的类型定义——把字符串分割成多个字符串，之后进行组合。这是`author.js`在进行上述处理后应该的样子：

```js
// author.js
export const typeDef = `
  type Author {
    id: Int!
    firstName: String
    lastName: String
    books: [Book]
  }
`;
```

而`book.js`应该是这样：

```js
// author.js
export const typeDef = `
  type Author {
    id: Int!
    firstName: String
    lastName: String
    books: [Book]
  }
`;
```

最后，我们在`schema.js`中把它们整合起来：

```js
// schema.js
import { typeDef as Author } from './author.js';
import { typeDef as Book } from './book.js';

const Query = `
  type Query {
    author(id: Int!): Post
    book(id: Int!): Post
  }
`;

makeExecutableSchema({
  typeDefs: [ Query, Author, Book ],
  resolvers: {},
});
```

我们在这里并没有做任何花哨的事情：我们只是导入恰好包含SDL的字符串。请注意，为了方便，你不需要自己组合字符串——`makeExecutableSchema`实际上可以直接接受一个类型定义的数组，以适应这种方法。

## Resolvers

现在，我们已经有办法将 schema 分解成各个部分，但我们还希望能够将每个 resolver 与对应 schema 相关的部分一起移动。一般来说，我们会需要把某个 schama 的 resolver 与该 schema 的模式定义保存在同一个文件中。

在上一个例子的基础上进行扩展，这是我们的`schema.js`文件，其中增加了一些resolver。

```js
// schema.js
import { typeDef as Author } from './author.js';
import { typeDef as Book } from './book.js';

const Query = `
  type Query {
    author(id: Int!): Post
    book(id: Int!): Post
  }
`;

const resolvers = {
  Query: {
    author: () => { ... },
    book: () => { ... },
  },
  Author: {
    name: () => { ... },
  },
  Book: {
    title: () => { ... },
  },
};

makeExecutableSchema({
  typeDefs: [ Query, Author, Book ],
  resolvers,
});
```

就像拆分schema定义字符串一样，我们也可以拆分`resolvers`对象。我们可以把其中的一部分放在`author.js`中，另一部分放在`book.js`中，然后导入它们，并使用`lodash.merge`函数把它们在`schema.js`中进行组合。

这是`author.js`会变成的样子：

```js
// author.js
export const typeDef = `
  type Author {
    id: Int!
    firstName: String
    lastName: String
    books: [Book]
  }
`;

export const resolvers = {
  Author: {
    books: () => { ... },
  }
};
```

而`book.js`应该变成这样：

```js
// book.js
export const typeDef = `
  type Book {
    title: String
    author: Author
  }
`;

export const resolvers = {
  Book: {
    author: () => { ... },
  }
};
```

然后，在`schema.js`中用`lodash.merge`把它们组合在一起：

```js
import { merge } from 'lodash';
import { 
  typeDef as Author, 
  resolvers as authorResolvers,
} from './author.js';
import { 
  typeDef as Book, 
  resolvers as bookResolvers,
} from './book.js';

const Query = `
  type Query {
    author(id: Int!): Author
    book(id: Int!): Book
  }
`;

const resolvers = {
  Query: { 
    ...,
  }
};

makeExecutableSchema({
  typeDefs: [ Query, Author, Book ],
  resolvers: merge(resolvers, authorResolvers, bookResolvers),
});
```

这样重构以后的结构与我们一开始的`resolvers`结构是完全等价的。

## 扩展类型

我们仍然在`schema.js`中把`authors`和`books`定义为`Query`上的顶层字段，然而，这些字段在逻辑上是与`Author`和`Book`联系在一起的，它们应该被放在`author.js`和`book.js`中。

为了达到这个目的，我们可以使用类型扩展。我们可以这样定义现有的`Query`类型：

```js
const Query = `
  type Query {
    _empty: String
  }
  
  extend type Query {
    author(id: Int!): Author 
  }
  
  extend type Query {
    book(id: Int!): Book 
  }
`;
```

> 注意：在当前版本的GraphQL中不能使用空类型，即使你打算在程序的其余部分扩展它。所以我们需要确保原来的Query类型至少有一个字段——在这种情况下，我们可以添加一个假的`_empty`字段。在未来的GraphQL版本中，我们也许可以使用空类型，然后在程序的其余部分进行扩展。
>

基本上，`extend`关键字让我们可以为已经定义的类型添加字段。我们可以使用这个关键字在`book.js`和`author.js`中定义与这些类型相关的`Query`字段。然后我们还应该在同一个地方为这些类型定义`Query resolver`。

下面是这样以后`author.js`的样子：

```js
// author.js

export const typeDef = `
  extend type Query {
    author(id: Int!): Author
  }  
  
  type Author {
    id: Int!
    firstName: String
    lastName: String
    books: [Book]
  }
`;

export const resolvers = {
  Query: {
    author: () => { ... },
  },
  Author: {
    books: () => { ... },
  }
};
```

这是`book.js`的样子：

```js
// book.js

export const typeDef = `
  extend type Query {
    book(id: Int!): Book
  }  

  type Book {
    title: String
    author: Author
  }
`;

export const resolvers = {
  Query: {
    book: () => { ... },
  },
  Book: {
    author: () => { ... },
  }
};
```

我们在`schema.js`中把它们组合到一起，就像前面那样：

```js
import { merge } from 'lodash';
import { 
  typeDef as Author, 
  resolvers as authorResolvers,
} from './author.js';
import { 
  typeDef as Book, 
  resolvers as bookResolvers,
} from './book.js'; 

// If you had Query fields not associated with a
// specific type you could put them here
const Query = `
  type Query {
    _empty: String
  }
`;

const resolvers = {};

makeExecutableSchema({
  typeDefs: [ Query, Author, Book ],
  resolvers: merge(resolvers, authorResolvers, bookResolvers),
});
```

现在，schema和resolver的定义与相关类型终于被放在一起了。

## 最后的建议

我们刚刚经历了服务器代码模块化的机制。这里有一些额外的提示，可能会对你了解如何划分代码库有所帮助：

1. 在学习、原型设计甚至构建POC时，将你的整个schema放在一个文件中可能是不错的。这样做的好处是可以快速浏览整个schema，或者向同事解释。  
2. 你可以按照功能来组织你的schema和resolver：例如，把与结账系统有关的东西放在一起，在电子商务网站中可能是有意义的。  
3. 将resolver与相关的schema定义保存在同一个文件中。这将使你能够有效地对你的代码进行管理。  
4. 使用[graphql-tag](https://github.com/apollographql/graphql-tag)将你的SDL类型定义用`gql`标签包装起来。如果你的编辑器使用GraphQL Plugin或Prettier对代码进行格式化，只要在SDL的前缀加上gql标签，编辑器中就能有对应的语法高亮。  
