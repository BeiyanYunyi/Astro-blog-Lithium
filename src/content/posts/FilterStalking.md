---
title: 用 NLP 模型过滤缠扰言论
date: 2025-03-28 05:00:00
description: 截至目前，王旷逸缠扰我已一年有余，但我始终不愿意放弃博客评论区。为此，我决定用 NLP 模型过滤掉他的言论，以保护自己与读者的心理健康。
tag:
  - 项目
  - 教程
---

截至目前，王旷逸缠扰（stalking）我已一年有余，但我始终不愿意放弃博客评论区。为此，我决定用 NLP 模型过滤掉他的言论，以保护自己与读者的心理健康。

> 然而，王某某却从未停止对博主的 stalking 行为，博客评论区也一次次被搞得不堪入目。隐藏王某某的评论是出于对观众情绪的保护，而不是对博主的。恰恰相反，为了保护观众，博主需要巡查评论区，被强制阅读骚扰言论。关闭评论区才是为了保护博主。然而，这却会牺牲其他用户的权利。
> ——2024.12.27，本博客告示

我始终认为，匿名性是互联网不可或缺的一部分。因此，在评论系统默认会记录 IP 及 UA 的情况下，我仍然主动关闭了其记录 IP 与 UA 的功能，并且不会要求用户在评论前先注册、登录。这就为王旷逸在评论区的持续缠扰提供了可能性。

> 缠扰（英语：stalking）又称纠缠、跟踪骚扰、或死缠烂打，是指一个人或团体对另一个人给予过多的关注，而造成被关注者的困扰和恐惧。
>
> ……
>
> 但在中国大陆现行司法体制下，依旧缺乏对个人面临非法跟踪、骚扰、监视等缠扰行为时的司法保护。即使是公众人物，面对私生饭缠扰时，（也）可能长期无法解决。
> ——[缠扰](https://zh.wikipedia.org/wiki/%E7%BA%8F%E6%93%BE)，维基百科

尽管我不会放弃将王旷逸绳之以法的努力，但也许评论区的重新开放不需要等待司法机构对王旷逸的裁决。只需要根据王旷逸的语言特征，就可以对其言论进行过滤，从而既不让读者因为阅读到他的言论而感到不适，又不会让我为了审查评论而强制观看，还不会因为关闭评论区而牺牲其他用户的权利。

过去一年间，王旷逸在评论区已经发布了 130 条，共计一万余字的评论，而评论总数也来到了 434 条。这已经足够训练防骚扰模型了。于是，在 ChatGPT（GPT-4o）的帮助下，我进行了如下实践：

## 数据导出

Waline 提供了导出功能，一键即可将数据库导出为 json。不过即使没有，我也可以读写它的 SQLite 数据库。进行简易处理后，用 polars 读取，过滤掉部分评论含有的 HTML 标签（缓解过拟合）即可：

```python
import polars as pl

df = pl.read_json("dataset.json").select(
    pl.col("comment").str.replace_all(r"<[^>]*>", ""), pl.col("label").cast(pl.UInt8)
)
```

## 基于 [TF-IDF](https://zh.wikipedia.org/wiki/Tf-idf) 分析的传统方法

简单地说，TF-IDF 是一类基于词频的统计方法。通过 TF-IDF 的处理，我可以得到不同文本中的词频信息，并进行相应的分类。此后，只需对新评论进行回归分析，即可判定其是否来自王旷逸。

```python
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report

# 3. 训练 / 测试集划分
X_train, X_test, y_train, y_test = train_test_split(
    df["comment"], df["label"], test_size=0.2, random_state=42
)

# 4. TF-IDF 向量化
vectorizer = TfidfVectorizer()  # 只保留 5000 个最常见的词
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# 5. 训练逻辑回归分类器
# model = LogisticRegression()
model = SVC(class_weight="balanced")
model.fit(X_train_tfidf, y_train)

# 6. 评估模型
y_pred = model.predict(X_test_tfidf)
print("准确率:", accuracy_score(y_test, y_pred))
print("分类报告:\n", classification_report(y_test, y_pred))

# 7. 预测新评论
new_comments = [
    "我觉得这个服务有点问题。",
]
new_comments_tfidf = vectorizer.transform(new_comments)
predictions = model.predict(new_comments_tfidf)
print("预测结果:", predictions)  # 1 表示该用户的风格，0 表示不是
```

遗憾的是，在现有数据中，TF-IDF 方法只能做到 80% 的准确率。这是因为 TF-IDF 只基于词频，却忽略了词语的先后组合关系，从而不能更准确地提取王旷逸言论的特征。为了做到这一点，我们需要引入基于神经网络的机器学习方法。也许 RNN 就足以进行分类，但我就是想耍耍最新最热的 Transformer 方法。

## 基于 BERT 的神经网络方法

我曾试图使用 LLM API 过滤王旷逸的言论，会触发 LLM 的风控，造成账号被限制。也许是因为王旷逸的言论实在不堪入目吧。因此，我需要找到一个较小的模型，以满足在服务器进行部署的需求。

[BERT](https://huggingface.co/google-bert/bert-base-chinese) 就是一个这样的模型。它可以使用 GPU 或 CPU 进行训练，训练时显存 / 内存占用大约 4G。如果使用 CPU 部署，内存占用可以控制到 1G 甚至 600M（qint8 量化）以内。

### 训练

而由于 BERT 的出色性能，我还可以在本地对其进行进一步微调训练（Fine-Tuning），以提升它对王旷逸言论的分类能力。

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertForSequenceClassification
from sklearn.model_selection import train_test_split


tokenizer = BertTokenizer.from_pretrained("bert-base-chinese")


# 数据集定义
class CommentDataset(Dataset):
    def __init__(self, comments, labels, tokenizer, max_len=128):
        self.comments = comments
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.comments)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            self.comments[idx],
            truncation=True,
            padding="max_length",
            max_length=self.max_len,
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "label": torch.tensor(self.labels[idx], dtype=torch.uint8),
        }


# 划分数据集
train_texts, val_texts, train_labels, val_labels = train_test_split(
    df["comment"].to_list(), df["label"].to_list(), test_size=0.2, random_state=42
)

train_dataset = CommentDataset(train_texts, train_labels, tokenizer)
val_dataset = CommentDataset(val_texts, val_labels, tokenizer)

train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)

# 加载模型
model = BertForSequenceClassification.from_pretrained("bert-base-chinese", num_labels=2)
# model=BertForSequenceClassification.from_pretrained("./fine_tuned_bert")
device = torch.device(
    "cuda"
    if torch.cuda.is_available()
    else "mps" if torch.mps.is_available() else "cpu"
)
model.to(device)

# 训练设置
optimizer = optim.AdamW(model.parameters(), lr=2e-5)
criterion = nn.CrossEntropyLoss()


def train_epoch(model, train_loader, optimizer, criterion):
    model.train()
    total_loss, correct = 0, 0
    for batch in train_loader:
        input_ids, attention_mask, labels = (
            batch["input_ids"].to(device),
            batch["attention_mask"].to(device),
            batch["label"].to(device),
        )
        optimizer.zero_grad()
        outputs = model(input_ids, attention_mask=attention_mask)
        loss = criterion(outputs.logits, labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
        correct += (outputs.logits.argmax(dim=1) == labels).sum().item()
    return total_loss / len(train_loader), correct / len(train_dataset)


def evaluate(model, val_loader, criterion):
    model.eval()
    total_loss, correct = 0, 0
    with torch.no_grad():
        for batch in val_loader:
            input_ids, attention_mask, labels = (
                batch["input_ids"].to(device),
                batch["attention_mask"].to(device),
                batch["label"].to(device),
            )
            outputs = model(input_ids, attention_mask=attention_mask)
            loss = criterion(outputs.logits, labels)
            total_loss += loss.item()
            correct += (outputs.logits.argmax(dim=1) == labels).sum().item()
    return total_loss / len(val_loader), correct / len(val_dataset)


# 训练循环
epochs = 2
for epoch in range(epochs):
    train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion)
    val_loss, val_acc = evaluate(model, val_loader, criterion)
    print(
        f"Epoch {epoch+1}/{epochs}: Train Loss={train_loss:.4f}, Train Acc={train_acc:.4f}, Val Loss={val_loss:.4f}, Val Acc={val_acc:.4f}"
    )

# 保存模型
model.save_pretrained("./fine_tuned_bert")
tokenizer.save_pretrained("./fine_tuned_bert")
```

通过观察输出可知，对各评论的识别准确率即超过 90%，最高达到了 95%。而从第三个 epoch 开始，模型在验证集上的准确率就出现了下降，这说明模型已经开始过拟合。因此，我选择了在第二个 epoch 后停止训练。

### 量化

为了部署，可以使用 onnx 对模型进行量化：

```python
import torch
import onnx
from transformers import BertTokenizer, BertForSequenceClassification
from onnxruntime.quantization import quantize_dynamic, preprocess, QuantType

device = torch.device("cpu")

model_path = "./fine_tuned_bert"

# 加载模型
model = BertForSequenceClassification.from_pretrained(model_path)
tokenizer = BertTokenizer.from_pretrained(model_path)
model.eval()

# 导出 ONNX
dummy_input_ids = torch.randint(0, 20000, (1, 128)).to(device).to(torch.int64)
dummy_attention_mask = torch.ones((1, 128)).to(device).to(torch.int64)

torch.onnx.export(
    model,
    (dummy_input_ids, dummy_attention_mask),
    "bert_model.onnx",
    input_names=["input_ids", "attention_mask"],
    output_names=["logits"],
    dynamic_axes={"input_ids": {0: "batch_size"}, "attention_mask": {0: "batch_size"}},
    opset_version=20,
)

print("ONNX 模型导出成功！")

# 加载 ONNX 模型
onnx_model = onnx.load("bert_model.onnx")

preprocess.quant_pre_process(
    input_model=onnx_model, output_model_path="bert_model_preprocess.onnx"
)

quantize_dynamic(
    model_input="bert_model_preprocess.onnx",
    model_output="bert_model_quantized.onnx",
    weight_type=QuantType.QInt8,
)

print("ONNX 量化完成，模型已保存！")
```

并使用如下代码对量化前后的模型进行对比：

```python
import onnxruntime as ort
import numpy as np


def evaluate(model_file: str, val_texts: list[str], val_labels: list[str]):
    session = ort.InferenceSession(
        model_file,
        providers=["CPUExecutionProvider"],  # CPU 部署
        sess_options=ort.SessionOptions(),
    )
    # 启用内存优化（减少 GPU/CPU 内存占用）
    session.set_providers(
        ["CPUExecutionProvider"],
        provider_options=[{"arena_extend_strategy": "kSameAsRequested"}],
    )
    correct = 0
    wrong = []

    for i in range(len(val_texts)):
        encoding = tokenizer(
            val_texts[i],
            padding="max_length",
            max_length=128,
            truncation=True,
            return_tensors="np",
        )
        input_ids, attention_mask = encoding["input_ids"], encoding["attention_mask"]
        outputs = session.run(
            ["logits"], {"input_ids": input_ids, "attention_mask": attention_mask}
        )
        output = int(np.argmax(outputs[0], axis=1)[0])
        if output == val_labels[i]:
            correct += 1
        else:
            wrong.append(val_texts[i])
        # correct += (outputs.logits.argmax(dim=1) == val_labels[i]).sum().item()
    return correct / len(val_dataset), wrong


original, quantized = evaluate("bert_model.onnx", val_texts, val_labels), evaluate(
    "bert_model_quantized.onnx", val_texts, val_labels
)
original, quantized
```

输出为 `(0.9195402298850575, 0.9195402298850575)`，这意味着量化后的准确率并没有下降。

### 部署

这样以后，就可以拿 FastAPI 简单写一个服务端并用于部署了：

```python
from fastapi import FastAPI
import numpy as np
from transformers import BertTokenizer
from pydantic import BaseModel
import onnxruntime as ort

session = ort.InferenceSession(
    "bert_model_quantized.onnx",
    providers=["CPUExecutionProvider"],  # CPU 部署
    sess_options=ort.SessionOptions(),
)

# 启用内存优化（减少 GPU/CPU 内存占用）
session.set_providers(
    ["CPUExecutionProvider"],
    provider_options=[{"arena_extend_strategy": "kSameAsRequested"}],
)


class Item(BaseModel):
    content: str


app = FastAPI()

# 加载模型
tokenizer: BertTokenizer = BertTokenizer.from_pretrained("./fine_tuned_bert")


@app.post("/predict")
def predict(comment: Item):
    encoding = tokenizer(
        comment.content,
        padding="max_length",
        max_length=128,
        truncation=True,
        return_tensors="np",
    )
    input_ids, attention_mask = encoding["input_ids"], encoding["attention_mask"]

    outputs = session.run(
        ["logits"], {"input_ids": input_ids, "attention_mask": attention_mask}
    )
    prediction = int(np.argmax(outputs[0], axis=1)[0])

    return {"predicted_label": prediction}
```

Waline 服务端有提供相关的接口，但文档不够清晰，总之稍作修改即可使用。

```js
// index.js
import 'dotenv/config';
import { createRequire } from 'node:module';
import path from 'node:path';
import Application from 'thinkjs';

const require = createRequire(import.meta.url);

const ROOT_PATH = path.resolve(require.resolve('@waline/vercel'), '..');

const instance = new Application({
  ROOT_PATH,
  APP_PATH: path.resolve(ROOT_PATH, 'src'),
  proxy: true, // use proxy
  env: 'production',
});

instance.run();

let config = {};

try {
  const { default: conf } = await import('./config.js');
  config = conf;
} catch {
  // do nothing
}
for (const k in config) {
  think.config(k, config[k]);
}
```

```js
// config.js
const config = {
  preSave: async (comment) => {
    /** @type {{ predicted_label: 0 | 1 }} */
    const res = await fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment.comment }),
    }).then((res) => res.json());
    if (res.predicted_label === 1) {
      think.logger.warn('Stalking detected');
      comment.status = 'waiting';
    }
  },
};

export default config;
```

此后，复制其它平台上王旷逸与他人的言论进行测试，发现模型也能明确地鉴别。这更让他假装路人的行径显得可笑至极。

> 然而惯犯如此，却连一只飞猴（flying monkeys）都养不起，只能一再注册小号来“说句公道话”，这在很大程度上说明了王旷逸的无能：他不是 NPD，而只能通过学习社会工程学来邯郸学步；他没有 NPD 的社交关系，而只能自己开小号来凑数。这种拙劣模仿自然错漏百出，而且总会有“真情流露”的时刻。
> ——[《告王旷逸（Wang Xueqian）》](/posts/ToWangKuangyi)，本博客

在 ChatGPT 的帮助下，以上过程共花费 5 人·小时，甚至低于王旷逸编写他过万字的缠扰言论的时间，显示了 LLM 辅助编程的价值。此后，我更可以不费力地更新模型，从而在王旷逸公开道歉、赔偿损失或遭受物理伤害、因故死亡以前，实现评论区对他的持续性屏蔽。

训练用语料与 python 代码均已在 GitHub [开源](https://github.com/BeiyanYunyi/class-it-up)。
