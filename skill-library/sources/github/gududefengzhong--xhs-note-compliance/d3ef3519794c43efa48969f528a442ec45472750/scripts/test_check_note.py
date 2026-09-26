#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.append(str(ROOT)
)

from check_note import scan, detect_signals, summarize, top_fixes


class TestCheckNote(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = json.loads((ROOT / "banned_words.json").read_text(encoding="utf-8"))

    def test_superlative_false_positive(self):
        text = "最好的朋友来帮我"
        hits = scan(text, self.db)
        self.assertFalse(
            any(h["category"] == "绝对化用语（组合形式）" and h["matched"] == "最好" for h in hits),
            "“最好”在‘最好的朋友’中不应被判为绝对化用语"
        )

    def test_absolute_phrase_hit(self):
        text = "这是全网最低价"
        hits = scan(text, self.db)
        self.assertTrue(
            any(h["category"] == "绝对化用语（广告法）" and h["matched"] == "全网最低价" for h in hits),
            "全网最低价 应该被判为广告法绝对化用语"
        )

    def test_affiliate_signal(self):
        text = "这款产品现在有返利，佣金很高"
        signals = detect_signals(text, self.db)
        self.assertTrue(
            any(sig["id"] == "affiliate_hint" for sig in signals),
            "返利/佣金提示应触发 affiliate_hint 信号"
        )

    def test_diversion_variants(self):
        for text in ("想要的加我vx：mm888", "加我微❤️：test123", "加微​信聊"):
            hits = scan(text, self.db)
            self.assertTrue(
                any(h["risk"] == "high" for h in hits),
                f"导流变体应命中高风险: {text!r}"
            )

    def test_effect_promise(self):
        hits = scan("我用了三天就见效了", self.db)
        self.assertTrue(
            any(h["risk"] == "high" for h in hits),
            "见效时限承诺应命中高风险"
        )

    def test_clean_note_passes(self):
        hits = scan("今天分享一个平价好用的保湿面霜，我自己回购了三次。", self.db)
        verdict, _ = summarize(hits)
        self.assertEqual(verdict, "pass", "正常分享文案应通过词库扫描")

    def test_top_fixes_category_priority(self):
        """Top 3 应按类别优先级排序（导流 > 医疗 > 绝对化），同类只占一个名额。"""
        text = "这是全网第一的精华，能消炎，想要的加我vx：mm888"
        fixes = top_fixes(scan(text, self.db))
        self.assertEqual(len(fixes), 3)
        self.assertIn("vx", fixes[0], "站外导流应排第一")
        self.assertIn("消炎", fixes[1], "医疗功效应排第二")
        self.assertIn("全网第一", fixes[2], "绝对化用语应排第三")

    def test_latin_word_boundary(self):
        hits = scan("我的设备型号是 RVX100", self.db)
        self.assertFalse(
            any(h["matched"].lower() == "vx" for h in hits),
            "vx 不应命中英文单词内部"
        )


if __name__ == "__main__":
    unittest.main()
