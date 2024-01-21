import acm.program.ConsoleProgram;

public class Pr51 extends ConsoleProgram {

    public void run(){

        while (true) {
            String word = readLine();
            println(removeDuplicateSymbols(word));
        }
    }

    private String removeDuplicateSymbols(String word) {

        String newWord = "";
        String wordBackUp = "";
        int counter = 0;

        for (int i = 0; i < word.length(); i++) {
            counter = 0;
            for (int j = 0; j < word.length(); j++){
                if (word.charAt(i) == word.charAt(j)){
                    counter++;
                }

            }
            if (wordBackUp.contains(Character.toString(word.charAt(i)))){
                newWord += "";
            } else {
                newWord += word.charAt(i);
            }

            if (counter>1){
                wordBackUp += word.charAt(i);
            }

        }
        return newWord;
    }

}
