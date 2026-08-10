from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from extract_sentences import extract_sentences, validate_curriculum


class ExtractSentencesTests(unittest.TestCase):
    def create_workbook(self, rows: list[tuple[object, ...]]) -> Path:
        temporary = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
        temporary.close()
        path = Path(temporary.name)
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = 'Sheet1'
        worksheet.append(['주차', '일차', '주제', '영어 표현', '한글 해석'])
        for row in rows:
            worksheet.append(row)
        workbook.save(path)
        return path

    def test_extracts_day_context_and_strips_source_numbering(self) -> None:
        path = self.create_workbook([
            ('1주차', 'Day 1', '생존 영어', '1. Excuse me.', '실례합니다.'),
            (None, None, None, '2. Thank you!', '감사합니다!'),
            ('1주차', 'Day 2', '생존 영어', '1. Where is the station?', '역이 어디에 있나요?'),
        ])
        self.addCleanup(path.unlink)

        self.assertEqual(extract_sentences(path), [
            {'id': 'day-01-01', 'english': 'Excuse me.', 'korean': '실례합니다.', 'day': 1, 'source': 'builtIn'},
            {'id': 'day-01-02', 'english': 'Thank you!', 'korean': '감사합니다!', 'day': 1, 'source': 'builtIn'},
            {'id': 'day-02-01', 'english': 'Where is the station?', 'korean': '역이 어디에 있나요?', 'day': 2, 'source': 'builtIn'},
        ])

    def test_rejects_blank_or_duplicate_sentences(self) -> None:
        path = self.create_workbook([
            ('1주차', 'Day 1', '생존 영어', '1. Hello.', '안녕하세요.'),
            (None, None, None, None, None),
            ('1주차', 'Day 2', '생존 영어', '1. Hello.', '안녕하세요.'),
        ])
        self.addCleanup(path.unlink)

        with self.assertRaisesRegex(ValueError, 'duplicate English'):
            extract_sentences(path)

    def test_rejects_sentence_rows_without_day_or_translation(self) -> None:
        path = self.create_workbook([
            (None, None, None, '1. Hello.', '안녕하세요.'),
        ])
        self.addCleanup(path.unlink)

        with self.assertRaisesRegex(ValueError, 'day'):
            extract_sentences(path)

    def test_curriculum_validation_rejects_invalid_sentence_contract(self) -> None:
        sentences = [
            {'id': f'day-{day:02d}-{number:02d}', 'english': 'Useful phrase', 'korean': '유용한 표현', 'day': day, 'source': 'builtIn'}
            for day in range(1, 61)
            for number in range(1, 11)
        ]
        sentences[0]['source'] = 'custom'

        with self.assertRaisesRegex(ValueError, 'invalid source'):
            validate_curriculum(sentences)


if __name__ == '__main__':
    unittest.main()
