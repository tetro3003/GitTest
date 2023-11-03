import acm.program.ConsoleProgram;
import acm.util.RandomGenerator;

public class Pr36try2 extends ConsoleProgram {

    RandomGenerator rgen = RandomGenerator.getInstance();
    private static final int TEST_COUNTER = 1000000;

    public void run(){

        int b = 0;

        for (int a = 0; a < TEST_COUNTER; a++){

            b += simulation();

        }

        println((double) b/TEST_COUNTER);

    }

    private int simulation(){
        int counter = 0;
        int headsCounter = 0;
//        boolean check = true;
        while(true){
            boolean isHead = rgen.nextBoolean();
            counter++;

            if (isHead){
                headsCounter++;
                if (headsCounter==3){
                    break;
                }
            } else {
                headsCounter = 0;
            }
        }
        return counter;
    }

}
