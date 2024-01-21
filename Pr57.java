import acm.program.ConsoleProgram;

import java.util.ArrayList;
import java.util.Arrays;

public class Pr57 extends ConsoleProgram {

    public void run(){
        println(anagram("ana", "nba"));

    }

    private boolean anagram(String wordOne, String wordTwo){

        if (wordOne.length() != wordTwo.length()) {
            return false;
        }

        int[] wordOneCharCount = new int[26];
        int[] wordTwoCharCount = new int[26];

        for (int i = 0; i < wordOne.length(); i++) {
            int counter = 0;
            for (int j = 0; j < wordOne.length(); j++){

                    if (wordOne.charAt(i) == wordOne.charAt(j)){
                        counter++;
                    }
            }

            wordOneCharCount[wordOne.charAt(i) - 'a'] = counter;

           }

        for (int i = 0; i < wordTwo.length(); i++) {
            int counter = 0;
            for (int j = 0; j < wordTwo.length(); j++){

                if (wordTwo.charAt(i) == wordTwo.charAt(j)){
                    counter++;
                }
            }

            wordTwoCharCount[wordTwo.charAt(i) - 'a'] = counter;

        }

        if (Arrays.equals(wordOneCharCount, wordTwoCharCount)){
            return true;
        } else {
            return false;
        }

    }

}
