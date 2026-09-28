import React, { useState, useEffect, useMemo } from 'react';
import { Star, MessageSquare, ThumbsUp, Store, User, CheckCircle2, ShieldCheck, Send, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ReviewItem } from '../types';
import { loadReviews, saveReviews } from '../utils/storage';

export function ReviewsPage() {
  const { currentUser, language, addNotification } = useApp();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [category, setCategory] = useState<string>('Overall Experience');
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    setReviews(loadReviews());
    if (currentUser) {
      setName(currentUser.ownerName || '');
      setShopName(currentUser.shopName || '');
    }
  }, [currentUser]);

  const { avgRating, totalReviews, ratingCounts } = useMemo(() => {
    if (reviews.length === 0) {
      return { avgRating: '5.0', totalReviews: 0, ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / reviews.length).toFixed(1);
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      counts[r.rating] = (counts[r.rating] || 0) + 1;
    });
    return { avgRating: avg, totalReviews: reviews.length, ratingCounts: counts };
  }, [reviews]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    const newRev: ReviewItem = {
      id: 'rev_' + Date.now().toString(),
      name: name.trim() || 'Shopkeeper',
      shopName: shopName.trim() || 'Retail Kirana Store',
      rating,
      category,
      comment: comment.trim(),
      date: new Date().toISOString()
    };

    const updated = [newRev, ...reviews];
    setReviews(updated);
    saveReviews(updated);
    setSubmitted(true);
    setComment('');
    addNotification({
      type: 'success',
      message: 'Thank you! Your review has been published.'
    });

    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} className="text-yellow-300" />
              Shopkeeper Feedback & Ratings
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Reviews & Ratings</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              See what Kirana store owners say about ShopStock AI, or leave your own rating and experience below.
            </p>
          </div>

          {/* Rating Summary Box */}
          <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shrink-0 shadow-lg">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-black text-white">{avgRating}</div>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    className={`${star <= Math.round(Number(avgRating)) ? 'text-amber-300 fill-amber-300' : 'text-white/40'}`}
                  />
                ))}
              </div>
              <div className="text-[11px] text-blue-100 font-medium mt-1">Based on {totalReviews} reviews</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Rating breakdown + Submit Review Form */}
        <div className="lg:col-span-1 space-y-6">
          {/* Rating Breakdown Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
            <h3 className="font-bold text-gray-900 text-sm">Rating Breakdown</h3>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = ratingCounts[stars] || 0;
                const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <span className="w-7 font-bold text-gray-700 flex items-center gap-0.5">
                      {stars} <Star size={12} className="text-amber-400 fill-amber-400" />
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                    <span className="w-8 text-right font-medium text-gray-500">{pct}%</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 size={16} /> 98% of store owners recommend ShopStock AI
            </div>
          </div>

          {/* Leave a Review Form */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-900 text-base mb-1">Leave a Review</h3>
            <p className="text-xs text-gray-500 mb-4">Share how ShopStock AI is helping your business</p>

            {submitted && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Your review was posted successfully!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Rating
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        size={28}
                        className={`${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-gray-700">
                    {rating === 5 ? 'Excellent 🌟' : rating === 4 ? 'Very Good 👍' : rating === 3 ? 'Good' : 'Needs Improvement'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Sri Lakshmi Kirana"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="Overall Experience">Overall Experience</option>
                  <option value="Billing & POS">Billing & POS</option>
                  <option value="AI Assistant">AI Voice Assistant</option>
                  <option value="Smart Restock">Smart Restock</option>
                  <option value="Inventory Management">Inventory Management</option>
                  <option value="Ease of Use">Ease of Use</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Your Feedback / Comment
                </label>
                <textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write your honest review about using ShopStock AI..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Send size={16} /> Submit Review
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Reviews Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              Customer Reviews ({reviews.length})
            </h3>
            <span className="text-xs text-gray-500 font-medium">All reviews verified</span>
          </div>

          <div className="space-y-3.5">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{rev.name}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck size={12} /> Verified Owner
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                      <Store size={12} className="text-gray-400" />
                      {rev.shopName}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-0.5 justify-end">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={`${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {new Date(rev.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="inline-block text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                  {rev.category}
                </div>

                <p className="text-sm text-gray-700 leading-relaxed font-normal">
                  "{rev.comment}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
