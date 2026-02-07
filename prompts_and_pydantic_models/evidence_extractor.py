"""
Evidence extraction module for finding supporting text snippets and image references.

This module extracts relevant evidence from source content to support extracted facts.
"""

import re
from typing import List, Optional
from difflib import SequenceMatcher


class EvidenceExtractor:
    """Extracts evidence snippets from source content."""
    
    def __init__(self, snippet_length: int = 200, max_snippets: int = 3):
        """
        Initialize the evidence extractor.
        
        Args:
            snippet_length: Maximum length of each evidence snippet in characters
            max_snippets: Maximum number of snippets to extract per fact
        """
        self.snippet_length = snippet_length
        self.max_snippets = max_snippets
    
    def extract_evidence_snippets(
        self,
        fact: str,
        source_content: str,
        max_snippets: Optional[int] = None
    ) -> List[str]:
        """
        Extract relevant text snippets from source that support the fact.
        
        Uses keyword matching and semantic similarity to find relevant passages.
        
        Args:
            fact: The fact statement to find evidence for
            source_content: The source text content
            max_snippets: Maximum number of snippets to return (overrides default)
            
        Returns:
            List of evidence snippets (text passages)
        """
        if max_snippets is None:
            max_snippets = self.max_snippets
        
        # Extract keywords from the fact
        keywords = self._extract_keywords(fact)
        if not keywords:
            return []
        
        # Split content into sentences
        sentences = self._split_into_sentences(source_content)
        
        # Score each sentence based on keyword matches
        scored_sentences = []
        for sentence in sentences:
            score = self._score_sentence(sentence, keywords, fact)
            if score > 0:
                scored_sentences.append((score, sentence))
        
        # Sort by score (highest first) and take top snippets
        scored_sentences.sort(key=lambda x: x[0], reverse=True)
        
        # Extract snippets, avoiding duplicates
        snippets = []
        seen_content = set()
        
        for score, sentence in scored_sentences[:max_snippets * 2]:  # Get more candidates
            # Clean and truncate snippet
            snippet = self._clean_snippet(sentence)
            if len(snippet) > self.snippet_length:
                snippet = snippet[:self.snippet_length] + "..."
            
            # Avoid duplicates
            snippet_normalized = snippet.lower().strip()
            if snippet_normalized not in seen_content and snippet:
                seen_content.add(snippet_normalized)
                snippets.append(snippet)
                if len(snippets) >= max_snippets:
                    break
        
        return snippets
    
    def extract_image_evidence(
        self,
        fact: str,
        image_descriptions: List[str]
    ) -> List[str]:
        """
        Extract image descriptions that support the fact.
        
        Args:
            fact: The fact statement to find evidence for
            image_descriptions: List of image descriptions or captions
            
        Returns:
            List of relevant image descriptions
        """
        keywords = self._extract_keywords(fact)
        if not keywords:
            return []
        
        relevant_images = []
        
        for img_desc in image_descriptions:
            score = self._score_sentence(img_desc, keywords, fact)
            if score > 0.3:  # Lower threshold for images
                relevant_images.append(img_desc)
        
        return relevant_images[:self.max_snippets]
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extract meaningful keywords from text."""
        # Remove common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
            'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their'
        }
        
        # Extract words (alphanumeric sequences)
        words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
        
        # Filter out stop words and return unique keywords
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        return list(set(keywords))
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitting (can be improved with nltk)
        sentences = re.split(r'[.!?]+\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _score_sentence(
        self, 
        sentence: str, 
        keywords: List[str], 
        fact: str
    ) -> float:
        """
        Score a sentence based on keyword matches and similarity to fact.
        
        Returns:
            Score between 0 and 1
        """
        sentence_lower = sentence.lower()
        
        # Count keyword matches
        keyword_matches = sum(1 for kw in keywords if kw in sentence_lower)
        keyword_score = keyword_matches / max(len(keywords), 1)
        
        # Calculate similarity to fact
        similarity = SequenceMatcher(None, fact.lower(), sentence_lower).ratio()
        
        # Combine scores (weighted)
        total_score = (keyword_score * 0.7) + (similarity * 0.3)
        
        return total_score
    
    def _clean_snippet(self, snippet: str) -> str:
        """Clean and normalize a text snippet."""
        # Remove extra whitespace
        snippet = re.sub(r'\s+', ' ', snippet)
        # Remove leading/trailing whitespace
        snippet = snippet.strip()
        return snippet
    
    def count_references(self, fact: str, content: str) -> int:
        """
        Count how many times a fact is referenced in source content.
        
        Args:
            fact: The fact statement
            content: Source content to search
            
        Returns:
            Number of references found
        """
        keywords = self._extract_keywords(fact)
        if not keywords:
            return 0
        
        content_lower = content.lower()
        fact_lower = fact.lower()
        
        # Count direct fact mentions
        direct_mentions = content_lower.count(fact_lower)
        
        # Count keyword-based matches (at least 50% of keywords present)
        sentences = self._split_into_sentences(content)
        keyword_matches = 0
        
        for sentence in sentences:
            sentence_lower = sentence.lower()
            matches = sum(1 for kw in keywords if kw in sentence_lower)
            if matches >= len(keywords) * 0.5:  # At least 50% of keywords
                keyword_matches += 1
        
        # Return the higher of direct mentions or keyword matches
        return max(direct_mentions, keyword_matches)
