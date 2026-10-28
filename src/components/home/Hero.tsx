import Link from 'next/link';
import { preload } from 'react-dom';
import { SITE_STATS } from '@/lib/constants/siteStats';

export default function Hero() {
  // Preload the hero image on the home page only (was preloaded on every route from the root layout)
  preload('/images/vande_bharat_01.avif', { as: 'image', type: 'image/avif', fetchPriority: 'high' });


  return (
    <section className="relative py-4 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#faf9f7]">
      {/* Decorative Elements - Railway themed */}
      <div className="hidden sm:block absolute top-20 right-10 sm:right-20 w-16 sm:w-24 h-16 sm:h-24 text-orange-500 opacity-80">
        <svg viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" />
        </svg>
      </div>
      <div className="hidden sm:block absolute top-40 right-32 sm:right-48 w-8 sm:w-12 h-8 sm:h-12 text-orange-400 opacity-60">
        <svg viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z" />
        </svg>
      </div>
      <div className="hidden sm:block absolute bottom-20 left-10 w-20 h-20 rounded-full border-4 border-stone-200 opacity-40"></div>
      <div className="hidden sm:block absolute top-10 left-1/4 w-3 h-3 bg-orange-500 rounded-full opacity-60"></div>

      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="order-2 lg:order-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-tight mb-4 sm:mb-6">
              Advance Your{' '}
              <span className="text-orange-600">Railway Career</span>{' '}
              with Departmental Exams
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-stone-600 mb-6 sm:mb-8 leading-relaxed">
              Master departmental exams across Mechanical, Personnel, Commercial, and other key departments. Access authentic exam papers, bilingual questions, and department-specific materials designed for railway professionals.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/departments"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-stone-900 text-white font-semibold rounded-full hover:bg-stone-800 transition-all duration-300 shadow-lg hover:shadow-xl text-sm sm:text-base text-center"
              >
                Get Started
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-3 sm:mt-12 pt-2 sm:pt-8 border-t-0 sm:border-t border-stone-200">
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-8 lg:gap-12">
                <div className="text-center sm:text-left">
                  <div className="text-xl sm:text-3xl lg:text-4xl font-bold text-orange-600 sm:text-stone-900">{SITE_STATS.departments}</div>
                  <div className="text-stone-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Departments</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-xl sm:text-3xl lg:text-4xl font-bold text-orange-600 sm:text-stone-900">{SITE_STATS.examPapers}</div>
                  <div className="text-stone-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Exam Papers</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-xl sm:text-2xl lg:text-4xl font-bold text-orange-600 sm:text-stone-900">{SITE_STATS.languageDisplay}</div>
                  <div className="text-stone-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{SITE_STATS.languageNames}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Image/Illustration */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative">
              {/* Main Image Container */}
              <div className="relative bg-gradient-to-br from-stone-100 to-stone-200 rounded-2xl sm:rounded-3xl overflow-hidden aspect-[4/3] shadow-xl sm:shadow-2xl">
                {/* Vande Bharat Train Image */}
                <div className="absolute inset-0">
                  <img
                    src="/images/vande_bharat_01.avif"
                    alt="Vande Bharat Express - Modern Indian Railway"
                    className="w-full h-full object-cover"
                    fetchPriority="high"
                  />
                  {/* Overlay for better text visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                </div>

                {/* Text overlay */}
                <div className="absolute bottom-8 left-0 right-0 px-4 sm:px-8 z-10">
                  <p className="text-white text-base sm:text-lg lg:text-xl font-semibold drop-shadow-lg">Prepare. Practice. Succeed.</p>
                </div>

                {/* Decorative track lines */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-stone-300/90 backdrop-blur-sm">
                  <div className="flex justify-around items-center h-full">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="w-6 h-2 bg-stone-400 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <div className="absolute -top-3 -right-3 sm:-top-6 sm:-right-6 w-14 sm:w-24 lg:w-25 h-14 sm:h-24 lg:h-25 bg-orange-500 rounded-full flex items-center justify-center shadow-lg sm:shadow-xl">
                <div className="text-center text-white">
                  <div className="text-xxs md:text-md lg:text-xl font-bold">{SITE_STATS.practiceQuestions}</div>
                  <div className="text-xxs md:text-sm">Questions</div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-3 sm:-bottom-11 sm:-left-8 bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-2 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 sm:w-10 sm:h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-stone-900 text-xxs sm:text-base">Railway Syllabus</div>
                    <div className="text-xxs sm:text-sm text-stone-500">Exam Pattern</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
