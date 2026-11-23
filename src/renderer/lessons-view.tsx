import { useMemo, useState } from 'react';
import type { ClassroomStore } from './classroom';
import { Icon } from './icons';
import { isLabel } from './letters';
import { categories, categoryFor, getSingleCoverWord, type Category, type Lesson, type TeacherLibrary } from './lessons';

interface LessonsViewProps {
  library: TeacherLibrary;
  store: ClassroomStore;
}

export function LessonsView({ library, store }: LessonsViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const visibleLessons = library.visible;
  const completedIds = store.data.completed;

  // Filter lessons by active category and search query
  const filteredLessons = useMemo(() => {
    return visibleLessons.filter((lesson) => {
      const lessonCatId = categoryFor(lesson.category).id;
      const matchesCategory = selectedCategory === 'all' || lessonCatId === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const titleMatch = lesson.title.toLowerCase().includes(q);
      const catMatch = categoryFor(lesson.category).title.toLowerCase().includes(q);
      const stepMatch = lesson.steps.some((step) => {
        if ('term' in step && step.term) return step.term.toLowerCase().includes(q);
        if ('letter' in step && step.letter) return step.letter.toLowerCase().includes(q);
        if ('word' in step && step.word) return step.word.toLowerCase().includes(q);
        return false;
      });

      return titleMatch || catMatch || stepMatch;
    });
  }, [visibleLessons, selectedCategory, searchQuery]);

  const totalFinished = useMemo(() => {
    return visibleLessons.filter((lesson) => completedIds.includes(lesson.id)).length;
  }, [visibleLessons, completedIds]);

  return (
    <section className="lessons-catalog-screen">
      {/* Page Heading & Motivation */}
      <header className="page-heading lessons-heading">
        <div className="heading-copy-group">
          <div className="catalog-badge-pill">
            <span className="badge-sparkle">📖</span>
            <span>All Lessons Library</span>
          </div>
          <h1>Lessons</h1>
          <p>Browse, study, and master sign language lessons at your own pace.</p>
        </div>
        <div className="catalog-progress-badge paper">
          <span className="progress-badge-icon">
            <Icon name="trophy" />
          </span>
          <div className="progress-badge-info">
            <span className="progress-badge-value">
              {totalFinished} of {visibleLessons.length}
            </span>
            <span className="progress-badge-label">Lessons Finished</span>
          </div>
        </div>
      </header>

      {/* Filter Toolbar: Category Pills + Search */}
      <div className="lessons-filter-bar">
        <div className="category-filter-pills" role="tablist" aria-label="Filter lessons by category">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            className={`filter-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <span>All Lessons</span>
            <span className="pill-count">({visibleLessons.length})</span>
          </button>

          {categories.map((cat) => {
            const count = visibleLessons.filter((l) => categoryFor(l.category).id === cat.id).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`filter-pill ${isSelected ? 'active' : ''} ${cat.tone}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span className="pill-mark" aria-hidden="true">{cat.mark}</span>
                <span>{cat.title}</span>
                <span className="pill-count">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Quick Search Input */}
        <div className="lessons-search-box">
          <Icon name="teach" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lessons or signs..."
            aria-label="Search lessons by title or sign"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Loading & Status States */}
      {library.status === 'loading' && (
        <div className="paper empty section-actions" role="status">
          <p>Opening lesson catalog…</p>
        </div>
      )}

      {/* Main Lessons Grid */}
      {library.status === 'ready' && (
        <>
          {filteredLessons.length > 0 ? (
            <div className="library-grid lessons-catalog-grid section-actions">
              {filteredLessons.map((lesson, index) => {
                const cat = categoryFor(lesson.category);
                const isCompleted = completedIds.includes(lesson.id);
                const stepCount = lesson.steps.length;

                const isAlphabet = cat.id === 'alphabet';
                const isNumbers = cat.id === 'numbers';

                // Display cover content:
                // - Alphabet: letter glyphs (e.g. A, B, C)
                // - Numbers: number glyphs (e.g. 1, 2, 3)
                // - All other categories: display ONLY ONE WORD (e.g. "Hello", "Family", etc.)
                let coverWord: string | undefined;
                let coverGlyphs: string[] = [];

                if (isAlphabet) {
                  coverGlyphs = [
                    ...new Set(lesson.steps.flatMap((step) => ('letter' in step && isLabel(step.letter) ? [step.letter] : [])))
                  ].slice(0, 3);
                } else if (isNumbers) {
                  coverGlyphs = [
                    ...new Set(
                      lesson.steps.flatMap((step) =>
                        step.kind === 'media' && /^\d+$/.test(step.term) ? [step.term] : []
                      )
                    )
                  ].slice(0, 3);
                } else {
                  coverWord = getSingleCoverWord(lesson);
                }

                return (
                  <a
                    key={lesson.id}
                    className="library-card lesson-catalog-card paper"
                    href={`#lesson/${lesson.id}`}
                    aria-label={`${lesson.title}, ${cat.title}, ${stepCount} steps`}
                  >
                    {/* Visual Card Cover */}
                    <div className={`library-cover ${cat.tone}`}>
                      {coverWord ? (
                        <span className="cover-single-word">{coverWord}</span>
                      ) : coverGlyphs.length > 0 ? (
                        coverGlyphs.map((glyph) => <span key={glyph}>{glyph}</span>)
                      ) : (
                        <span>
                          <Icon name="book" />
                        </span>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="lesson-catalog-body">
                      <div className="lesson-meta-row">
                        <span className={`category-tag-pill ${cat.tone}`}>
                          {cat.title}
                        </span>
                        {isCompleted && (
                          <span className="lesson-completed-pill">
                            ✓ Finished
                          </span>
                        )}
                      </div>

                      <h2 className="lesson-card-title">{lesson.title}</h2>

                      <div className="lesson-card-footer">
                        <span className="step-count-label">
                          {stepCount} {stepCount === 1 ? 'sign' : 'signs'}
                        </span>
                        <span className="lesson-start-link">
                          {isCompleted ? 'Review' : 'Start'}
                          <Icon name="arrow" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="paper empty section-actions">
              <h2>No lessons found</h2>
              <p>
                {searchQuery
                  ? `No lessons matching "${searchQuery}". Try a different keyword.`
                  : 'There are no published lessons in this category yet.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  className="button secondary btn-3d"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
